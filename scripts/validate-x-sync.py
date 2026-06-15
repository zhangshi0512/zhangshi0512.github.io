#!/usr/bin/env python3
"""Validate Twikit cookie auth and X Article body availability."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from lib.scraper import (
    create_client,
    fetch_article_payload,
    fetch_recent_tweets,
)

USERNAME = "Simonsterrific"


def section(title: str) -> None:
    print(f"\n=== {title} ===")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Validate Twikit X Article sync setup")
    parser.add_argument("--tweet-id", help="Inspect a specific tweet/article status ID")
    args = parser.parse_args()

    try:
        client = create_client()
    except RuntimeError as exc:
        print(str(exc))
        print("\nSetup:")
        print("  1. Log into x.com in your browser")
        print("  2. Export cookies as JSON (name/value pairs)")
        print("  3. Add TWITTER_COOKIE_JSON as a GitHub Actions secret")
        print("  4. Run locally:")
        print('     $env:TWITTER_COOKIE_JSON=\'[{"name":"auth_token","value":"..."}, ...]\'')
        print("     python scripts/validate-x-sync.py")
        raise SystemExit(1) from exc

    section("Cookie auth")
    print("Twikit client initialized with provided cookies.")

    if args.tweet_id:
        section(f"Single tweet {args.tweet_id}")
        article = await fetch_article_payload(client, args.tweet_id, f"https://x.com/i/status/{args.tweet_id}")
        if not article:
            print("FAIL: Could not load X Article body for this tweet ID.")
            raise SystemExit(2)
        print(f"Title: {article.title}")
        print(f"URL: {article.url}")
        print(f"Body length: {len(article.body_markdown)} chars")
        print(f"Cover URL: {article.cover_url or '(none)'}")
        print(f"Preview: {article.body_markdown[:240].replace(chr(10), ' ')}...")
        section("Go / no-go")
        print("PASS: Article body fetched successfully via Twikit.")
        return

    section("Recent timeline scan")
    timeline = await fetch_recent_tweets(client, USERNAME, max_count=25, max_pages=2)
    print(f"Fetched {len(timeline)} recent tweet(s)")

    candidates = [tweet for tweet in timeline if tweet.is_candidate]
    print(f"Found {len(candidates)} X Article candidate(s)")

    if not candidates:
        print("\nNo article candidates in recent tweets.")
        print("If you have older articles, pass --tweet-id <status_id> to inspect one directly.")
        section("Go / no-go")
        print("PASS: Cookie auth works. No recent articles to validate body extraction.")
        return

    verified = 0
    for candidate in candidates[:3]:
        article = await fetch_article_payload(client, candidate.tweet_id, candidate.url)
        print("\n---")
        print(f"Tweet ID: {candidate.tweet_id}")
        if not article:
            print("Could not fetch article body.")
            continue
        verified += 1
        print(f"Title: {article.title}")
        print(f"URL: {article.url}")
        print(f"Body length: {len(article.body_markdown)} chars")
        print(f"Preview: {article.body_markdown[:240].replace(chr(10), ' ')}...")

    section("Go / no-go")
    if verified > 0:
        print("PASS: Twikit can fetch X Article bodies. Proceed with scripts/sync-x-articles.py")
    else:
        print("FAIL: Candidates found but article bodies could not be loaded.")
        raise SystemExit(2)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except SystemExit:
        raise
    except Exception as exc:
        print(f"\nValidation failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
