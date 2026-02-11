#!/usr/bin/env python3
"""
GA4 + GSC Daily Data Collector for effect.moe
===============================================
Fetches yesterday's analytics data from Google Analytics 4 and
Google Search Console, then stores in effect-site D1 via API.

Usage:
  python analytics_collector.py              # Collect yesterday's data
  python analytics_collector.py --days 7     # Backfill last 7 days
  python analytics_collector.py --dry-run    # Show data without posting

Requirements:
  google-auth, google-api-python-client, google-analytics-data
"""

import asyncio
import json
import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path

import aiohttp
from google.oauth2 import service_account
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    RunReportRequest,
)
from googleapiclient.discovery import build

# --- Configuration ---
GA4_CREDENTIALS_PATH = Path.home() / "mcp-credentials" / "claudemcp-451912-2830c1577732.json"
GSC_CREDENTIALS_PATH = Path.home() / "mcp-credentials" / "claudemcp-451912-8cb2cd63795c.json"
GA4_PROPERTY_ID = "350046473"
SITE_URL = "https://effect-site.effectmoe.workers.dev"
API_URL = f"{SITE_URL}/api/analytics"
TELEGRAM_BOT_TOKEN = "8226533383:AAGA0Tzo-tiEC_7j_MTnlaO2vNk0iq3xGg8"
TELEGRAM_CHAT_ID = "8588084195"

# GSC site URL - use verified property; workers.dev may not be registered
# Will auto-detect from available properties
GSC_SITE_KEYWORDS = ["effect"]  # Match any property containing these keywords

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("analytics-collector")


# --- GA4 Data Collection ---

def collect_ga4(start_date: str, end_date: str) -> list[dict]:
    """Fetch GA4 pageview data for date range."""
    logger.info(f"Collecting GA4 data: {start_date} to {end_date}")

    try:
        credentials = service_account.Credentials.from_service_account_file(
            str(GA4_CREDENTIALS_PATH),
            scopes=["https://www.googleapis.com/auth/analytics.readonly"],
        )
        client = BetaAnalyticsDataClient(credentials=credentials)

        request = RunReportRequest(
            property=f"properties/{GA4_PROPERTY_ID}",
            date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
            dimensions=[
                Dimension(name="date"),
                Dimension(name="pagePath"),
            ],
            metrics=[
                Metric(name="screenPageViews"),
                Metric(name="sessions"),
                Metric(name="totalUsers"),
                Metric(name="averageSessionDuration"),
                Metric(name="bounceRate"),
            ],
        )

        response = client.run_report(request)

        rows = []
        for row in response.rows:
            date_raw = row.dimension_values[0].value  # YYYYMMDD
            date_formatted = f"{date_raw[:4]}-{date_raw[4:6]}-{date_raw[6:8]}"
            rows.append({
                "date": date_formatted,
                "page_path": row.dimension_values[1].value,
                "pageviews": int(row.metric_values[0].value),
                "sessions": int(row.metric_values[1].value),
                "users": int(row.metric_values[2].value),
                "avg_session_duration": float(row.metric_values[3].value),
                "bounce_rate": float(row.metric_values[4].value),
            })

        logger.info(f"  GA4: {len(rows)} rows collected")
        return rows

    except Exception as e:
        logger.error(f"GA4 collection failed: {e}")
        return []


# --- GSC Data Collection ---

def collect_gsc(start_date: str, end_date: str) -> list[dict]:
    """Fetch GSC search analytics data for date range."""
    logger.info(f"Collecting GSC data: {start_date} to {end_date}")

    try:
        credentials = service_account.Credentials.from_service_account_file(
            str(GSC_CREDENTIALS_PATH),
            scopes=["https://www.googleapis.com/auth/webmasters.readonly"],
        )
        service = build("searchconsole", "v1", credentials=credentials)

        # First, find the right site URL
        site_list = service.sites().list().execute()
        available_sites = [s["siteUrl"] for s in site_list.get("siteEntry", [])]
        logger.info(f"  GSC available sites: {available_sites}")

        # Find matching site
        site_url = None
        for candidate in available_sites:
            if "effect" in candidate.lower():
                site_url = candidate
                break

        if not site_url:
            if available_sites:
                site_url = available_sites[0]
                logger.warning(f"  No effect.moe site found, using: {site_url}")
            else:
                logger.error("  No GSC sites available")
                return []

        logger.info(f"  Using GSC site: {site_url}")

        # Query by page
        response = service.searchanalytics().query(
            siteUrl=site_url,
            body={
                "startDate": start_date,
                "endDate": end_date,
                "dimensions": ["date", "page", "query"],
                "rowLimit": 500,
            },
        ).execute()

        rows = []
        for row in response.get("rows", []):
            keys = row.get("keys", [])
            rows.append({
                "date": keys[0] if len(keys) > 0 else start_date,
                "page": keys[1] if len(keys) > 1 else "/",
                "query": keys[2] if len(keys) > 2 else None,
                "clicks": row.get("clicks", 0),
                "impressions": row.get("impressions", 0),
                "ctr": round(row.get("ctr", 0), 4),
                "position": round(row.get("position", 0), 1),
            })

        logger.info(f"  GSC: {len(rows)} rows collected")
        return rows

    except Exception as e:
        logger.error(f"GSC collection failed: {e}")
        return []


# --- Post to D1 API ---

async def post_to_d1(source: str, rows: list[dict]) -> bool:
    """Post collected data to effect-site D1 API."""
    if not rows:
        return True

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                API_URL,
                json={"source": source, "rows": rows},
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    logger.info(f"  D1 {source}: {data.get('inserted', 0)} rows inserted")
                    return True
                text = await resp.text()
                logger.error(f"  D1 API error: {resp.status} {text[:200]}")
                return False
    except Exception as e:
        logger.error(f"  D1 post failed: {e}")
        return False


# --- Telegram ---

async def send_telegram(message: str) -> bool:
    """Send summary notification via Telegram."""
    if not TELEGRAM_BOT_TOKEN:
        return True
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": TELEGRAM_CHAT_ID, "text": message},
            ) as resp:
                return resp.status == 200
    except Exception:
        return False


# --- Main ---

async def run_collector(days: int = 1, dry_run: bool = False) -> None:
    """Main collection pipeline."""
    end_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    logger.info(f"Analytics collection: {start_date} to {end_date}")

    # Collect GA4
    ga4_rows = collect_ga4(start_date, end_date)

    # Collect GSC
    gsc_rows = collect_gsc(start_date, end_date)

    if dry_run:
        logger.info("=== DRY RUN - Data collected but not posted ===")
        if ga4_rows:
            logger.info(f"GA4 sample: {json.dumps(ga4_rows[:3], indent=2)}")
        if gsc_rows:
            logger.info(f"GSC sample: {json.dumps(gsc_rows[:3], indent=2)}")
        return

    # Post to D1
    ga4_ok = await post_to_d1("ga4", ga4_rows)
    gsc_ok = await post_to_d1("gsc", gsc_rows)

    # Summary
    summary = (
        f"[Analytics] {start_date} to {end_date}\n"
        f"GA4: {len(ga4_rows)} rows {'OK' if ga4_ok else 'FAIL'}\n"
        f"GSC: {len(gsc_rows)} rows {'OK' if gsc_ok else 'FAIL'}"
    )

    if ga4_rows:
        total_pv = sum(r["pageviews"] for r in ga4_rows)
        total_users = sum(r["users"] for r in ga4_rows)
        summary += f"\nTotal: {total_pv} PV, {total_users} users"

    if gsc_rows:
        total_clicks = sum(r["clicks"] for r in gsc_rows)
        total_impressions = sum(r["impressions"] for r in gsc_rows)
        summary += f"\nSearch: {total_clicks} clicks, {total_impressions} impressions"

    logger.info(summary)
    await send_telegram(summary)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="GA4/GSC data collector for effect.moe")
    parser.add_argument("--days", type=int, default=1, help="Number of days to collect (default: yesterday only)")
    parser.add_argument("--dry-run", action="store_true", help="Collect but don't post to D1")
    parser.add_argument("--no-telegram", action="store_true")
    args = parser.parse_args()

    if args.no_telegram:
        global TELEGRAM_BOT_TOKEN
        TELEGRAM_BOT_TOKEN = ""

    asyncio.run(run_collector(days=args.days, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
