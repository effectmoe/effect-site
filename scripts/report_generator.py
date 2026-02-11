#!/usr/bin/env python3
"""
Weekly Report Generator for effect.moe
========================================
Combines SEO patrol results + GSC search data into a unified report.
Sends via Telegram and optionally posts to Notion.

Usage:
  python report_generator.py              # Generate this week's report
  python report_generator.py --days 14    # Report for last 14 days
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timedelta

import aiohttp

# --- Configuration (from environment) ---
SITE_URL = os.environ.get("EFFECT_SITE_URL", "https://effect-site.effectmoe.workers.dev")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
NOTION_API_KEY = os.environ.get("NOTION_API_KEY", "")
NOTION_REPORTS_DB = os.environ.get("NOTION_REPORTS_DB", "")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("report-gen")


async def fetch_json(session: aiohttp.ClientSession, url: str) -> dict | list:
    """Fetch JSON from API endpoint."""
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
        if resp.status == 200:
            return await resp.json()
        logger.warning(f"API {resp.status}: {url}")
        return {}


async def collect_data(days: int) -> dict:
    """Collect all data from D1 APIs."""
    async with aiohttp.ClientSession() as session:
        patrol = await fetch_json(
            session,
            f"{SITE_URL}/api/patrol-results?mode=daily&limit=30",
        )
        patrol_weekly = await fetch_json(
            session,
            f"{SITE_URL}/api/patrol-results?mode=weekly&limit=5",
        )
        gsc = await fetch_json(
            session,
            f"{SITE_URL}/api/analytics?source=gsc&days={days}",
        )

    return {
        "patrol_daily": patrol.get("results", []),
        "patrol_weekly": patrol_weekly.get("results", []),
        "gsc": gsc.get("results", []),
    }


def generate_report(data: dict, days: int) -> str:
    """Generate a text report from collected data."""
    now = datetime.now()
    period_start = (now - timedelta(days=days)).strftime("%Y-%m-%d")
    period_end = now.strftime("%Y-%m-%d")

    lines = [
        f"=== effect.moe Weekly Report ===",
        f"Period: {period_start} ~ {period_end}",
        f"Generated: {now.strftime('%Y-%m-%d %H:%M')}",
        "",
    ]

    # --- SEO Health ---
    lines.append("--- SEO Health ---")
    patrol_results = data.get("patrol_daily", [])
    if patrol_results:
        total_runs = len(patrol_results)
        clean_runs = sum(1 for r in patrol_results if r.get("issues_count", 0) == 0)
        lines.append(f"Patrol runs: {total_runs} ({clean_runs} clean)")

        # Latest status
        latest = patrol_results[0] if patrol_results else {}
        lines.append(
            f"Latest: {latest.get('pages_ok', 0)}/{latest.get('pages_total', 0)} pages OK, "
            f"{latest.get('endpoints_ok', 0)}/{latest.get('endpoints_total', 0)} endpoints OK"
        )

        issues_total = sum(r.get("issues_count", 0) for r in patrol_results)
        if issues_total > 0:
            lines.append(f"Total issues detected: {issues_total}")
        else:
            lines.append("No issues detected this period")
    else:
        lines.append("No patrol data available")

    lines.append("")

    # --- Search Performance (GSC) ---
    lines.append("--- Search Performance (GSC) ---")
    gsc_data = data.get("gsc", [])
    if gsc_data:
        total_clicks = sum(r.get("clicks", 0) for r in gsc_data)
        total_impressions = sum(r.get("impressions", 0) for r in gsc_data)
        avg_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
        positions = [r.get("position", 0) for r in gsc_data if r.get("position", 0) > 0]
        avg_position = sum(positions) / len(positions) if positions else 0

        lines.append(f"Clicks: {total_clicks}")
        lines.append(f"Impressions: {total_impressions}")
        lines.append(f"Avg CTR: {avg_ctr:.1f}%")
        lines.append(f"Avg Position: {avg_position:.1f}")

        # Top queries
        query_clicks: dict[str, int] = {}
        query_impressions: dict[str, int] = {}
        for r in gsc_data:
            q = r.get("query")
            if q:
                query_clicks[q] = query_clicks.get(q, 0) + r.get("clicks", 0)
                query_impressions[q] = query_impressions.get(q, 0) + r.get("impressions", 0)

        if query_impressions:
            lines.append("")
            lines.append("Top queries by impressions:")
            sorted_queries = sorted(query_impressions.items(), key=lambda x: x[1], reverse=True)[:5]
            for q, imp in sorted_queries:
                clicks = query_clicks.get(q, 0)
                lines.append(f"  {q}: {imp} imp, {clicks} clicks")

        # Top pages
        page_impressions: dict[str, int] = {}
        for r in gsc_data:
            p = r.get("page", "/")
            page_impressions[p] = page_impressions.get(p, 0) + r.get("impressions", 0)

        if page_impressions:
            lines.append("")
            lines.append("Top pages by impressions:")
            sorted_pages = sorted(page_impressions.items(), key=lambda x: x[1], reverse=True)[:5]
            for p, imp in sorted_pages:
                short = p.replace("https://notion.effect.moe", "").replace(SITE_URL, "")
                lines.append(f"  {short or '/'}: {imp} imp")
    else:
        lines.append("No GSC data available")

    lines.append("")
    lines.append(f"Site: {SITE_URL}")

    return "\n".join(lines)


async def send_telegram(message: str) -> bool:
    """Send report via Telegram."""
    if not TELEGRAM_BOT_TOKEN:
        return True
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": TELEGRAM_CHAT_ID, "text": message},
            ) as resp:
                if resp.status == 200:
                    logger.info("Telegram report sent")
                    return True
                logger.error(f"Telegram error: {resp.status}")
                return False
    except Exception as e:
        logger.error(f"Telegram failed: {e}")
        return False


async def post_to_notion(report: str, days: int) -> bool:
    """Post report as a page in Notion database."""
    if not NOTION_API_KEY:
        return True

    now = datetime.now()
    title = f"Weekly Report {now.strftime('%Y-%m-%d')}"

    # Convert report text to Notion blocks
    blocks = []
    for line in report.split("\n"):
        if line.startswith("==="):
            continue  # Skip title (use page title instead)
        if line.startswith("---") and not line.startswith("----"):
            # Section header
            section_name = line.replace("---", "").strip()
            if section_name:
                blocks.append({
                    "object": "block",
                    "type": "heading_2",
                    "heading_2": {
                        "rich_text": [{"type": "text", "text": {"content": section_name}}]
                    },
                })
        elif line.strip():
            blocks.append({
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"type": "text", "text": {"content": line}}]
                },
            })

    payload = {
        "parent": {"database_id": NOTION_REPORTS_DB},
        "properties": {
            "Title": {"title": [{"text": {"content": title}}]},
            "Category": {"select": {"name": "Report"}},
            "Tags": {"multi_select": [{"name": "SEO"}, {"name": "Analytics"}]},
            "Published": {"checkbox": False},
        },
        "children": blocks[:100],  # Notion limit
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.notion.com/v1/pages",
                json=payload,
                headers={
                    "Authorization": f"Bearer {NOTION_API_KEY}",
                    "Notion-Version": "2022-06-28",
                    "Content-Type": "application/json",
                },
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    logger.info(f"Notion report created: {data.get('id', 'unknown')}")
                    return True
                text = await resp.text()
                logger.warning(f"Notion API {resp.status}: {text[:200]}")
                return False
    except Exception as e:
        logger.error(f"Notion post failed: {e}")
        return False


async def run_report(days: int = 7, dry_run: bool = False) -> None:
    """Main report pipeline."""
    logger.info(f"Generating report for last {days} days")

    data = await collect_data(days)
    report = generate_report(data, days)

    logger.info(f"\n{report}")

    if dry_run:
        logger.info("=== DRY RUN - report not sent ===")
        return

    await send_telegram(report)
    await post_to_notion(report, days)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Weekly report generator for effect.moe")
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-telegram", action="store_true")
    args = parser.parse_args()

    if args.no_telegram:
        global TELEGRAM_BOT_TOKEN
        TELEGRAM_BOT_TOKEN = ""

    asyncio.run(run_report(days=args.days, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
