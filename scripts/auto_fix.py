#!/usr/bin/env python3
"""
Auto-Fix Script for effect.moe SEO Patrol
==========================================
Reads patrol results, classifies issues, and takes automated action:
- Operational fixes: cache purge, redeploy
- Code fixes: create branch → fix → PR via gh CLI
- Unresolvable: create GitHub issue

Usage:
  python auto-fix.py                          # Process latest daily patrol
  python auto-fix.py --results path/to.json   # Process specific result file
  python auto-fix.py --dry-run                # Show what would be done
"""

import asyncio
import json
import logging
import os
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any

import aiohttp

# --- Configuration ---
SITE_URL = "https://effect-site.effectmoe.workers.dev"
REPO = "effectmoe/effect-site"
PROJECT_DIR = Path(__file__).parent.parent
PATROL_DATA_DIR = Path(__file__).parent / "patrol-data"
TELEGRAM_BOT_TOKEN = "8226533383:AAGA0Tzo-tiEC_7j_MTnlaO2vNk0iq3xGg8"
TELEGRAM_CHAT_ID = "8588084195"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("auto-fix")


# --- Issue Classification ---

class FixType(Enum):
    CACHE_PURGE = "cache_purge"
    REDEPLOY = "redeploy"
    CODE_FIX = "code_fix"
    GITHUB_ISSUE = "github_issue"
    IGNORE = "ignore"


@dataclass
class ClassifiedIssue:
    original: str
    fix_type: FixType
    description: str
    fix_command: str | None = None
    fix_files: list[str] = field(default_factory=list)
    fix_content: dict[str, str] = field(default_factory=dict)
    severity: str = "medium"  # low, medium, high, critical


def classify_issues(issues: list[str]) -> list[ClassifiedIssue]:
    """Classify patrol issues into actionable fix types."""
    classified = []

    for issue in issues:
        issue_upper = issue.upper()

        # Initial run - no action needed
        if "Initial patrol run" in issue:
            classified.append(ClassifiedIssue(
                original=issue,
                fix_type=FixType.IGNORE,
                description="First run, baseline established",
            ))
            continue

        # CRITICAL: Endpoint down
        if "ENDPOINT DOWN" in issue_upper:
            if "llms.txt" in issue or "robots.txt" in issue or "sitemap.xml" in issue:
                classified.append(ClassifiedIssue(
                    original=issue,
                    fix_type=FixType.REDEPLOY,
                    description="Critical endpoint down, redeploy needed",
                    severity="critical",
                ))
            else:
                classified.append(ClassifiedIssue(
                    original=issue,
                    fix_type=FixType.GITHUB_ISSUE,
                    description="Endpoint returning errors",
                    severity="high",
                ))
            continue

        # CRITICAL: LLMO infrastructure
        if "CRITICAL" in issue_upper and ("llms.txt" in issue or "robots.txt" in issue):
            classified.append(ClassifiedIssue(
                original=issue,
                fix_type=FixType.REDEPLOY,
                description="LLMO critical file inaccessible",
                severity="critical",
            ))
            continue

        # BROKEN page
        if "BROKEN" in issue_upper:
            classified.append(ClassifiedIssue(
                original=issue,
                fix_type=FixType.CACHE_PURGE,
                description="Page broken, try cache purge first",
                severity="high",
            ))
            continue

        # Schema lost
        if "SCHEMA LOST" in issue_upper:
            classified.append(ClassifiedIssue(
                original=issue,
                fix_type=FixType.GITHUB_ISSUE,
                description="JSON-LD schema types removed - needs investigation",
                severity="high",
            ))
            continue

        # SEO regressions
        if "LOST" in issue_upper and ("meta description" in issue.lower() or "og" in issue.lower()):
            classified.append(ClassifiedIssue(
                original=issue,
                fix_type=FixType.GITHUB_ISSUE,
                description="SEO metadata regression detected",
                severity="medium",
            ))
            continue

        # Title changes
        if "CHANGED" in issue_upper and "title" in issue.lower():
            classified.append(ClassifiedIssue(
                original=issue,
                fix_type=FixType.IGNORE,
                description="Title changed (may be intentional from Notion CMS)",
                severity="low",
            ))
            continue

        # LLMO score regression
        if "REGRESSION" in issue_upper and "llmo score" in issue.lower():
            classified.append(ClassifiedIssue(
                original=issue,
                fix_type=FixType.GITHUB_ISSUE,
                description="LLMO score dropped significantly",
                severity="high",
            ))
            continue

        # Default: create issue for human review
        classified.append(ClassifiedIssue(
            original=issue,
            fix_type=FixType.GITHUB_ISSUE,
            description="Unclassified issue, needs human review",
            severity="medium",
        ))

    return classified


# --- Fix Executors ---

def run_cmd(cmd: list[str], cwd: str | None = None) -> tuple[int, str, str]:
    """Run a shell command and return (returncode, stdout, stderr)."""
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=cwd or str(PROJECT_DIR),
        timeout=120,
    )
    return result.returncode, result.stdout, result.stderr


async def execute_cache_purge(issue: ClassifiedIssue, dry_run: bool) -> str:
    """Purge KV cache to resolve stale data issues."""
    if dry_run:
        return f"[DRY RUN] Would purge KV cache keys"

    logger.info("Purging KV cache...")
    keys_to_purge = ["articles:list", "llms-txt"]

    for key in keys_to_purge:
        code, out, err = run_cmd([
            "npx", "wrangler", "kv", "key", "delete",
            "--binding=CACHE", "--remote", key,
        ])
        if code == 0:
            logger.info(f"  Purged: {key}")
        else:
            logger.warning(f"  Failed to purge {key}: {err}")

    return "KV cache purged"


async def execute_redeploy(issue: ClassifiedIssue, dry_run: bool) -> str:
    """Rebuild and redeploy the site."""
    if dry_run:
        return "[DRY RUN] Would rebuild and redeploy"

    logger.info("Rebuilding...")
    code, out, err = run_cmd(["npm", "run", "build"])
    if code != 0:
        return f"Build failed: {err[:200]}"

    logger.info("Deploying...")
    code, out, err = run_cmd([
        "npx", "wrangler", "deploy",
        "--config", "build/server/wrangler.json",
    ])
    if code != 0:
        return f"Deploy failed: {err[:200]}"

    # Extract deploy URL from output
    for line in out.split("\n"):
        if "effectmoe.workers.dev" in line:
            return f"Redeployed: {line.strip()}"

    return "Redeployed successfully"


async def create_github_issue(issue: ClassifiedIssue, dry_run: bool) -> str:
    """Create a GitHub issue for human review."""
    title = f"[SEO Patrol] {issue.description}"
    body = f"""## Auto-detected Issue

**Severity:** {issue.severity}
**Detected:** {datetime.now().strftime('%Y-%m-%d %H:%M')}
**Site:** {SITE_URL}

### Details
{issue.original}

### Classification
{issue.description}

---
*Auto-generated by seo-patrol auto-fix*
"""

    if dry_run:
        return f"[DRY RUN] Would create issue: {title}"

    code, out, err = run_cmd([
        "gh", "issue", "create",
        "--repo", REPO,
        "--title", title,
        "--body", body,
        "--label", "seo-patrol,automated",
    ])

    if code != 0:
        # Labels might not exist, try without
        code, out, err = run_cmd([
            "gh", "issue", "create",
            "--repo", REPO,
            "--title", title,
            "--body", body,
        ])

    if code == 0:
        issue_url = out.strip()
        return f"Issue created: {issue_url}"
    return f"Failed to create issue: {err[:200]}"


# --- Main Pipeline ---

async def send_telegram(message: str) -> bool:
    """Send Telegram notification."""
    if not TELEGRAM_BOT_TOKEN:
        return True
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": message,
            }) as resp:
                return resp.status == 200
    except Exception as e:
        logger.error(f"Telegram error: {e}")
        return False


async def process_patrol_results(results_path: Path, dry_run: bool = False) -> None:
    """Main: read patrol results, classify issues, execute fixes."""
    if not results_path.exists():
        logger.error(f"Results file not found: {results_path}")
        return

    results = json.loads(results_path.read_text())

    # Re-run comparison to get issues
    # (patrol already saved them but we re-derive for independence)
    prev_path = PATROL_DATA_DIR / f"latest-{results.get('mode', 'daily')}.json"
    if prev_path.exists() and prev_path != results_path:
        previous = json.loads(prev_path.read_text())
    else:
        previous = None

    issues = derive_issues(results, previous)

    if not issues:
        logger.info("No issues found, nothing to fix")
        return

    # Classify
    classified = classify_issues(issues)

    # Filter out IGNORE
    actionable = [c for c in classified if c.fix_type != FixType.IGNORE]

    if not actionable:
        logger.info("All issues classified as ignorable")
        return

    logger.info(f"Found {len(actionable)} actionable issues:")
    for c in actionable:
        logger.info(f"  [{c.fix_type.value}] [{c.severity}] {c.original}")

    # Execute fixes
    results_log = []
    for c in actionable:
        if c.fix_type == FixType.CACHE_PURGE:
            result = await execute_cache_purge(c, dry_run)
        elif c.fix_type == FixType.REDEPLOY:
            result = await execute_redeploy(c, dry_run)
        elif c.fix_type == FixType.GITHUB_ISSUE:
            result = await create_github_issue(c, dry_run)
        elif c.fix_type == FixType.CODE_FIX:
            # Future: implement code fix with branch + PR
            result = await create_github_issue(c, dry_run)
        else:
            result = "Skipped"

        results_log.append(f"[{c.fix_type.value}] {result}")
        logger.info(f"  -> {result}")

    # Send summary via Telegram
    summary_lines = [
        f"[Auto-Fix] {len(actionable)} issues processed",
        f"Site: {SITE_URL}",
        "",
    ]
    for entry in results_log:
        summary_lines.append(f"  {entry}")

    await send_telegram("\n".join(summary_lines))

    # Save fix log
    fix_log = {
        "timestamp": datetime.now().isoformat(),
        "dry_run": dry_run,
        "issues_total": len(issues),
        "issues_actionable": len(actionable),
        "results": results_log,
    }
    log_path = PATROL_DATA_DIR / f"fix-log-{datetime.now().strftime('%Y%m%d-%H%M')}.json"
    log_path.write_text(json.dumps(fix_log, ensure_ascii=False, indent=2))
    logger.info(f"Fix log saved to {log_path}")


def derive_issues(current: dict, previous: dict | None) -> list[str]:
    """Derive issues from patrol results (same logic as seo-patrol.py)."""
    issues = []

    if previous is None:
        return issues

    current_pages = {p["url"]: p for p in current.get("pages", [])}
    previous_pages = {p["url"]: p for p in previous.get("pages", [])}

    for url, page in current_pages.items():
        prev_page = previous_pages.get(url)
        if not prev_page:
            continue

        if page.get("error") and not prev_page.get("error"):
            issues.append(f"BROKEN: {url} - {page['error']}")
            continue

        if page.get("seo") and prev_page.get("seo"):
            curr_seo = page["seo"]
            prev_seo = prev_page["seo"]

            if curr_seo.get("title") != prev_seo.get("title"):
                issues.append(f"CHANGED: {url} title changed")

            if not curr_seo.get("description") and prev_seo.get("description"):
                issues.append(f"LOST: {url} meta description removed")

            if not curr_seo.get("og_title") and prev_seo.get("og_title"):
                issues.append(f"LOST: {url} OG title removed")

        if page.get("schema") and prev_page.get("schema"):
            curr_types = set(page["schema"].get("types", []))
            prev_types = set(prev_page["schema"].get("types", []))
            removed = prev_types - curr_types
            if removed:
                issues.append(f"SCHEMA LOST: {url} removed: {removed}")

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

    current_endpoints = {e["url"]: e for e in current.get("endpoints", [])}
    previous_endpoints = {e["url"]: e for e in previous.get("endpoints", [])}

    for url, ep in current_endpoints.items():
        prev_ep = previous_endpoints.get(url)
        if prev_ep and prev_ep.get("status") == 200 and ep.get("status") != 200:
            issues.append(f"ENDPOINT DOWN: {url} (was 200, now {ep.get('status')})")

    return issues


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Auto-fix for SEO patrol issues")
    parser.add_argument("--results", type=str, help="Path to patrol results JSON")
    parser.add_argument("--mode", choices=["daily", "weekly"], default="daily")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done")
    parser.add_argument("--no-telegram", action="store_true")
    args = parser.parse_args()

    if args.no_telegram:
        global TELEGRAM_BOT_TOKEN
        TELEGRAM_BOT_TOKEN = ""

    if args.results:
        results_path = Path(args.results)
    else:
        results_path = PATROL_DATA_DIR / f"latest-{args.mode}.json"

    asyncio.run(process_patrol_results(results_path, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
