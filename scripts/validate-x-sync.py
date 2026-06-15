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
    timeline = await fetch_recent_tweets(client, USERNAME, max_count=50, max_pages=3)
    print(f"Fetched {len(timeline)} recent tweet(s) from user timeline")

    if not timeline:
        print("\nFAIL: Timeline returned 0 tweets. Cookies may be expired or API blocked.")
        raise SystemExit(2)

    verified = 0
    for tweet in timeline[:25]:
        article = await fetch_article_payload(client, tweet.tweet_id, tweet.url)
        if not article:
            continue
        verified += 1
        print("\n---")
        print(f"Tweet ID: {tweet.tweet_id}")
        print(f"Title: {article.title}")
        print(f"URL: {article.url}")
        print(f"Body length: {len(article.body_markdown)} chars")
        print(f"Preview: {article.body_markdown[:240].replace(chr(10), ' ')}...")
        if verified >= 3:
            break

    section("Go / no-go")
    if verified > 0:
        print(f"PASS: Found {verified} X Article(s) via Twikit.")
    else:
        print("Timeline works but no X Articles found in the last 25 tweets checked.")
        print("If you have older articles, they will sync on the next monthly run (up to 100 tweets).")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except SystemExit:
        raise
    except Exception as exc:
        print(f"\nValidation failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
