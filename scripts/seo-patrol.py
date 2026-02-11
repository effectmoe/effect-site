#!/usr/bin/env python3
"""
SEO/LLMO Patrol Script for effect.moe
======================================
Runs SEO + LLMO analysis on effect-site pages, compares with previous results,
and sends Telegram notification with summary.

Usage:
  python seo-patrol.py                 # Daily quick check
  python seo-patrol.py --mode weekly   # Weekly full report

Requirements:
  - seo-llmo-analyzer project at ~/projects/seo-llmo-analyzer
  - aiohttp, beautifulsoup4 (from seo-llmo-analyzer venv)
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

# Add seo-llmo-analyzer to path
ANALYZER_ROOT = Path.home() / "projects" / "seo-llmo-analyzer"
sys.path.insert(0, str(ANALYZER_ROOT))

# Add scripts dir to path for auto_fix import
SCRIPTS_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPTS_DIR))

import aiohttp
from analyzers.seo_analyzer import SEOAnalyzer
from analyzers.llmo_analyzer import LLMOAnalyzer
from analyzers.schema_analyzer import SchemaAnalyzer

# --- Configuration (from environment) ---
SITE_URL = os.environ.get("EFFECT_SITE_URL", "https://effect-site.effectmoe.workers.dev")
ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY", "")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
PATROL_DATA_DIR = Path(__file__).parent / "patrol-data"
PATROL_DATA_DIR.mkdir(exist_ok=True)

# Pages to check
PAGES = [
    "/",
    "/articles",
    "/about",
]

# Special endpoints to verify
ENDPOINTS = [
    "/llms.txt",
    "/robots.txt",
    "/sitemap.xml",
]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("seo-patrol")


async def fetch_html(session: aiohttp.ClientSession, url: str) -> str | None:
    """Fetch HTML content from a URL."""
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            if resp.status == 200:
                return await resp.text()
            logger.warning(f"HTTP {resp.status} for {url}")
            return None
    except Exception as e:
        logger.error(f"Failed to fetch {url}: {e}")
        return None


async def check_endpoint(session: aiohttp.ClientSession, url: str) -> dict:
    """Check if an endpoint is accessible and return basic info."""
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            text = await resp.text()
            return {
                "url": url,
                "status": resp.status,
                "content_type": resp.headers.get("Content-Type", ""),
                "size": len(text),
                "has_content": len(text) > 10,
            }
    except Exception as e:
        return {
            "url": url,
            "status": 0,
            "error": str(e),
            "has_content": False,
        }


async def analyze_page(session: aiohttp.ClientSession, url: str) -> dict:
    """Run SEO + LLMO analysis on a single page."""
    html = await fetch_html(session, url)
    if not html:
        return {"url": url, "error": "Failed to fetch page", "seo": None, "llmo": None}

    # SEO Analysis
    seo_analyzer = SEOAnalyzer(html, url)
    seo_result = seo_analyzer.analyze()

    # Schema Analysis (returns List[StructuredDataItem])
    schema_analyzer = SchemaAnalyzer(html, url)
    schema_items = schema_analyzer.analyze()

    # LLMO Analysis
    llmo_analyzer = LLMOAnalyzer(html, url)
    llmo_result = await llmo_analyzer.analyze()

    # Safe attribute access helpers
    seo_basic = seo_result.basic
    seo_og = seo_basic.og if seo_basic else None

    return {
        "url": url,
        "timestamp": datetime.now().isoformat(),
        "seo": {
            "title": seo_basic.title if seo_basic else None,
            "description": seo_basic.description if seo_basic else None,
            "canonical": seo_basic.canonical if seo_basic else None,
            "og_title": seo_og.title if seo_og else None,
            "og_description": seo_og.description if seo_og else None,
            "og_image": seo_og.image if seo_og else None,
            "link_stats": {
                "internal": seo_result.links.internal if seo_result.links else 0,
                "external": seo_result.links.external if seo_result.links else 0,
            },
            "image_stats": {
                "total": seo_result.images.total if seo_result.images else 0,
                "missing_alt": seo_result.images.missing_alt if seo_result.images else 0,
            },
            "errors": seo_result.errors,
        },
        "schema": {
            "types": [item.type for item in schema_items] if schema_items else [],
            "count": len(schema_items) if schema_items else 0,
        },
        "llmo": {
            "llms_txt_exists": llmo_result.llms_txt.exists if llmo_result.llms_txt else False,
            "robots_txt_exists": llmo_result.robots_txt.exists if llmo_result.robots_txt else False,
            "robots_allows_ai": llmo_result.robots_txt.allows_ai if llmo_result.robots_txt else True,
            "robots_blocked_bots": llmo_result.robots_txt.blocked_bots if llmo_result.robots_txt else [],
            "content_quality": {
                "word_count": llmo_result.content_quality.word_count if llmo_result.content_quality else 0,
                "heading_structure": llmo_result.content_quality.heading_structure if llmo_result.content_quality else False,
                "faq_present": llmo_result.content_quality.faq_present if llmo_result.content_quality else False,
                "semantic_html": llmo_result.content_quality.semantic_html if llmo_result.content_quality else False,
            },
            "score": llmo_result.score,
            "recommendations": llmo_result.recommendations[:5] if llmo_result.recommendations else [],
        },
    }


def compare_results(current: dict, previous: dict | None) -> list[str]:
    """Compare current results with previous and return list of changes/issues."""
    issues = []

    if previous is None:
        issues.append("Initial patrol run - no previous data to compare")
        return issues

    # Compare page results
    current_pages = {p["url"]: p for p in current.get("pages", [])}
    previous_pages = {p["url"]: p for p in previous.get("pages", [])}

    for url, page in current_pages.items():
        prev_page = previous_pages.get(url)
        if not prev_page:
            issues.append(f"NEW: {url} (not in previous run)")
            continue

        if page.get("error") and not prev_page.get("error"):
            issues.append(f"BROKEN: {url} - {page['error']}")
            continue

        # Check SEO regressions
        if page.get("seo") and prev_page.get("seo"):
            curr_seo = page["seo"]
            prev_seo = prev_page["seo"]

            if curr_seo.get("title") != prev_seo.get("title"):
                issues.append(f"CHANGED: {url} title: '{prev_seo.get('title')}' -> '{curr_seo.get('title')}'")

            if not curr_seo.get("description") and prev_seo.get("description"):
                issues.append(f"LOST: {url} meta description removed")

            if not curr_seo.get("og_title") and prev_seo.get("og_title"):
                issues.append(f"LOST: {url} OG title removed")

        # Check schema changes
        if page.get("schema") and prev_page.get("schema"):
            curr_types = set(page["schema"].get("types", []))
            prev_types = set(prev_page["schema"].get("types", []))
            removed_types = prev_types - curr_types
            if removed_types:
                issues.append(f"SCHEMA LOST: {url} removed types: {removed_types}")

        # Check LLMO regressions
        if page.get("llmo") and prev_page.get("llmo"):
            curr_llmo = page["llmo"]
            prev_llmo = prev_page["llmo"]

            if not curr_llmo.get("llms_txt_exists") and prev_llmo.get("llms_txt_exists"):
                issues.append("CRITICAL: llms.txt is no longer accessible")

            if not curr_llmo.get("robots_txt_exists") and prev_llmo.get("robots_txt_exists"):
                issues.append("CRITICAL: robots.txt is no longer accessible")

            curr_score = curr_llmo.get("score", 0)
            prev_score = prev_llmo.get("score", 0)
            if prev_score > 0 and curr_score < prev_score - 10:
                issues.append(f"REGRESSION: LLMO score dropped {prev_score} -> {curr_score}")

    # Compare endpoints
    current_endpoints = {e["url"]: e for e in current.get("endpoints", [])}
    previous_endpoints = {e["url"]: e for e in previous.get("endpoints", [])}

    for url, ep in current_endpoints.items():
        prev_ep = previous_endpoints.get(url)
        if prev_ep and prev_ep.get("status") == 200 and ep.get("status") != 200:
            issues.append(f"ENDPOINT DOWN: {url} (was 200, now {ep.get('status')})")

    return issues


def generate_summary(results: dict, issues: list[str], mode: str) -> str:
    """Generate a Telegram-friendly summary message."""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    mode_label = "Weekly Full Report" if mode == "weekly" else "Daily Quick Check"

    lines = [
        f"[effect.moe SEO Patrol] {mode_label}",
        f"Time: {ts}",
        f"Target: {SITE_URL}",
        "",
    ]

    # Page summary
    pages = results.get("pages", [])
    ok_count = sum(1 for p in pages if not p.get("error"))
    lines.append(f"Pages: {ok_count}/{len(pages)} OK")

    # Endpoint summary
    endpoints = results.get("endpoints", [])
    ep_ok = sum(1 for e in endpoints if e.get("status") == 200)
    lines.append(f"Endpoints: {ep_ok}/{len(endpoints)} OK")

    # Schema summary
    for page in pages:
        if page.get("schema") and page["schema"].get("count", 0) > 0:
            url_short = page["url"].replace(SITE_URL, "")
            types = ", ".join(page["schema"]["types"][:5])
            lines.append(f"  Schema {url_short}: {types}")

    # Issues
    if issues:
        lines.append("")
        has_critical = any(i.startswith("CRITICAL") or i.startswith("BROKEN") for i in issues)
        lines.append(f"{'!!! ISSUES FOUND !!!' if has_critical else 'Changes detected:'}")
        for issue in issues[:10]:
            lines.append(f"  - {issue}")
        if len(issues) > 10:
            lines.append(f"  ... and {len(issues) - 10} more")
    else:
        lines.append("")
        lines.append("All checks passed. No changes detected.")

    return "\n".join(lines)


async def send_telegram(message: str) -> bool:
    """Send a message via Telegram bot."""
    if not TELEGRAM_BOT_TOKEN:
        logger.info("Telegram notification skipped (no token)")
        return True
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML" if "<" in message else None,
    }
    # Remove None values
    payload = {k: v for k, v in payload.items() if v is not None}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                if resp.status == 200:
                    logger.info("Telegram notification sent")
                    return True
                text = await resp.text()
                logger.error(f"Telegram API error: {resp.status} {text}")
                return False
    except Exception as e:
        logger.error(f"Failed to send Telegram message: {e}")
        return False


async def post_results_to_d1(results: dict) -> bool:
    """Post patrol results to effect-site D1 via API."""
    api_url = f"{SITE_URL}/api/patrol-results"
    headers = {}
    if ADMIN_API_KEY:
        headers["X-API-Key"] = ADMIN_API_KEY
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                api_url,
                json=results,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                if resp.status == 200:
                    logger.info("Results posted to D1")
                    return True
                logger.warning(f"D1 API returned {resp.status}")
                return False
    except Exception as e:
        logger.warning(f"Could not post to D1: {e}")
        return False


async def run_patrol(mode: str = "daily") -> None:
    """Main patrol execution."""
    logger.info(f"Starting SEO patrol (mode={mode}) for {SITE_URL}")

    results: dict[str, Any] = {
        "mode": mode,
        "timestamp": datetime.now().isoformat(),
        "site_url": SITE_URL,
        "pages": [],
        "endpoints": [],
    }

    async with aiohttp.ClientSession() as session:
        # Check endpoints
        logger.info("Checking endpoints...")
        for endpoint in ENDPOINTS:
            url = urljoin(SITE_URL, endpoint)
            ep_result = await check_endpoint(session, url)
            results["endpoints"].append(ep_result)
            status = ep_result.get("status", 0)
            logger.info(f"  {endpoint}: {status}")

        # Analyze pages
        logger.info("Analyzing pages...")
        for page_path in PAGES:
            url = urljoin(SITE_URL, page_path)
            page_result = await analyze_page(session, url)
            results["pages"].append(page_result)
            has_error = "error" in page_result and page_result["error"]
            logger.info(f"  {page_path}: {'ERROR' if has_error else 'OK'}")

        # In weekly mode, also analyze individual article pages from sitemap
        if mode == "weekly":
            logger.info("Fetching article URLs from sitemap...")
            sitemap_html = await fetch_html(session, urljoin(SITE_URL, "/sitemap.xml"))
            if sitemap_html:
                import re
                article_urls = re.findall(r"<loc>(.*?/articles/[^<]+)</loc>", sitemap_html)
                for article_url in article_urls[:10]:  # Limit to 10 articles
                    page_result = await analyze_page(session, article_url)
                    results["pages"].append(page_result)
                    logger.info(f"  {article_url}: OK")

    # Load previous results
    result_file = PATROL_DATA_DIR / f"latest-{mode}.json"
    previous = None
    if result_file.exists():
        try:
            previous = json.loads(result_file.read_text())
        except json.JSONDecodeError:
            logger.warning("Could not parse previous results")

    # Compare
    issues = compare_results(results, previous)

    # Save current results
    result_file.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    logger.info(f"Results saved to {result_file}")

    # Also save timestamped copy
    ts_file = PATROL_DATA_DIR / f"patrol-{datetime.now().strftime('%Y%m%d-%H%M')}.json"
    ts_file.write_text(json.dumps(results, ensure_ascii=False, indent=2))

    # Generate summary
    summary = generate_summary(results, issues, mode)
    logger.info(f"\n{summary}")

    # Send Telegram notification
    await send_telegram(summary)

    # Post to D1 (best-effort)
    await post_results_to_d1(results)

    # Auto-fix: if issues found (excluding initial run), trigger auto-fix
    actionable_issues = [i for i in issues if "Initial patrol run" not in i]
    if actionable_issues:
        logger.info(f"Issues detected ({len(actionable_issues)}), running auto-fix...")
        try:
            from auto_fix import classify_issues, execute_cache_purge, execute_redeploy, create_github_issue, FixType
            classified = classify_issues(actionable_issues)
            actionable = [c for c in classified if c.fix_type != FixType.IGNORE]
            for c in actionable:
                if c.fix_type == FixType.CACHE_PURGE:
                    result = await execute_cache_purge(c, dry_run=False)
                elif c.fix_type == FixType.REDEPLOY:
                    result = await execute_redeploy(c, dry_run=False)
                elif c.fix_type in (FixType.GITHUB_ISSUE, FixType.CODE_FIX):
                    result = await create_github_issue(c, dry_run=False)
                else:
                    result = "Skipped"
                logger.info(f"  Auto-fix [{c.fix_type.value}]: {result}")
        except ImportError:
            logger.warning("auto-fix module not available, skipping auto-fix")
        except Exception as e:
            logger.error(f"Auto-fix failed: {e}")

    logger.info("Patrol complete")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="SEO/LLMO Patrol for effect.moe")
    parser.add_argument("--mode", choices=["daily", "weekly"], default="daily",
                        help="Patrol mode: daily (quick) or weekly (full)")
    parser.add_argument("--no-telegram", action="store_true",
                        help="Skip Telegram notification")
    args = parser.parse_args()

    if args.no_telegram:
        global TELEGRAM_BOT_TOKEN
        TELEGRAM_BOT_TOKEN = ""

    asyncio.run(run_patrol(args.mode))


if __name__ == "__main__":
    main()
