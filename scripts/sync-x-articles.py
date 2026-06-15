#!/usr/bin/env python3
"""Sync X Articles from @Simonsterrific into _posts/ using Twikit (cookie auth)."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from lib.images import mirror_cover_image
from lib.markdown import (
    build_filename,
    build_post_body,
    build_post_markdown,
    hash_content,
)
from lib.scraper import (
    create_client,
    fetch_article_payload,
    fetch_recent_tweets,
    filter_new_tweets,
    highest_tweet_id,
    timeline_from_tweet_ids,
)
from lib.state import load_state, save_state

POSTS_DIR = ROOT / "_posts"
ASSETS_DIR = ROOT / "assets" / "x-articles"
USERNAME = os.environ.get("X_USERNAME", "Simonsterrific")
DRY_RUN = os.environ.get("DRY_RUN", "").lower() in {"1", "true", "yes"}
SKIP_IMAGES = os.environ.get("SKIP_IMAGES", "").lower() in {"1", "true", "yes"}
MAX_TWEETS = int(os.environ.get("MAX_TWEETS", "100"))
MAX_PAGES = int(os.environ.get("MAX_PAGES", "5"))
ARTICLE_TWEET_IDS = [
    item.strip()
    for item in os.environ.get("X_ARTICLE_TWEET_IDS", "").split(",")
    if item.strip()
]


def log(message: str) -> None:
    print(f"[sync-x-articles] {message}")


def collect_existing_filenames() -> set[str]:
    POSTS_DIR.mkdir(parents=True, exist_ok=True)
    return {path.name for path in POSTS_DIR.glob("*.md")}


def write_post_file(filename: str, content: str) -> None:
    path = POSTS_DIR / filename
    if DRY_RUN:
        log(f"DRY RUN: would write {path} ({len(content)} bytes)")
        return
    path.write_text(content, encoding="utf-8")
    log(f"Wrote {path}")


async def build_markdown(article_payload) -> str:
    cover_path = None
    if not SKIP_IMAGES and article_payload.cover_url:
        cover_path = mirror_cover_image(
            article_payload.tweet_id,
            article_payload.cover_url,
            ASSETS_DIR,
            dry_run=DRY_RUN,
        )

    article_dict = {
        "title": article_payload.title,
        "body_markdown": article_payload.body_markdown,
        "url": article_payload.url,
        "created_at": article_payload.created_at,
        "tweet_id": article_payload.tweet_id,
    }
    body = build_post_body(article_dict, cover_image_path=cover_path)
    return build_post_markdown(article_dict, body)


async def process_article(client, timeline_tweet, state, used_names, results):
    existing = state["articles"].get(timeline_tweet.tweet_id)
    article_payload = await fetch_article_payload(client, timeline_tweet.tweet_id, timeline_tweet.url)
    if not article_payload:
        log(f"Skip {timeline_tweet.tweet_id}: not an X Article or body unavailable")
        return

    content_sha = hash_content(article_payload.plain_text)
    date = article_payload.created_at[:10]

    if existing:
        if existing.get("content_sha") == content_sha:
            log(f"Skip unchanged article {timeline_tweet.tweet_id} ({existing['filename']})")
            results["skipped"].append(existing["filename"])
            return

        log(f"Article {timeline_tweet.tweet_id} edited on X — updating {existing['filename']}")
        markdown = await build_markdown(article_payload)
        write_post_file(existing["filename"], markdown)
        state["articles"][timeline_tweet.tweet_id] = {
            **existing,
            "content_sha": content_sha,
            "updated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        }
        results["updated"].append(existing["filename"])
        return

    filename = build_filename(date, article_payload.title, used_names)
    markdown = await build_markdown(article_payload)
    write_post_file(filename, markdown)
    state["articles"][timeline_tweet.tweet_id] = {
        "filename": filename,
        "published_at": article_payload.created_at,
        "content_sha": content_sha,
        "source_url": article_payload.url,
        "synced_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }
    results["created"].append(filename)


def append_step_summary(results: dict[str, list[str]]) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    lines = [
        "## X Article Sync (Twikit)",
        "",
        f"- Created: {len(results['created'])}",
        f"- Updated: {len(results['updated'])}",
        f"- Skipped (unchanged): {len(results['skipped'])}",
        "",
    ]
    if results["created"]:
        lines.extend(["### New posts", *[f"- `_posts/{name}`" for name in results["created"]], ""])
    if results["updated"]:
        lines.extend(["### Updated posts", *[f"- `_posts/{name}`" for name in results["updated"]], ""])
    with open(summary_path, "a", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")


async def main() -> None:
    state = load_state(ROOT, USERNAME)
    used_names = collect_existing_filenames()
    client = create_client(log=log)

    log(f"Syncing X Articles for @{state.get('username') or USERNAME} via Twikit")
    if state.get("since_id"):
        log(f"Tracking tweets newer than since_id={state['since_id']}")
    else:
        log(f"First run: scanning up to {MAX_TWEETS} recent tweets ({MAX_PAGES} page(s))")

    timeline = await fetch_recent_tweets(
        client,
        USERNAME,
        max_count=MAX_TWEETS,
        max_pages=MAX_PAGES,
        log=log,
    )

    if not timeline and ARTICLE_TWEET_IDS:
        log(
            f"Timeline/search returned 0 tweets; using X_ARTICLE_TWEET_IDS "
            f"({len(ARTICLE_TWEET_IDS)} id(s))"
        )
        timeline = timeline_from_tweet_ids(ARTICLE_TWEET_IDS, username=USERNAME)

    if not timeline:
        log("WARNING: Fetched 0 tweets from timeline and search fallback.")
        log("Check TWITTER_COOKIE_JSON is fresh and @Simonsterrific is accessible.")
        log("Re-export cookies from x.com while logged in (auth_token + ct0 required).")
        log("Optional bootstrap: set X_ARTICLE_TWEET_IDS to comma-separated status IDs.")
        raise SystemExit(1)

    to_check = filter_new_tweets(timeline, state.get("since_id"))
    # Bootstrap: if nothing synced yet, scan full fetched timeline for articles.
    if not state.get("articles"):
        to_check = timeline

    log(
        f"Fetched {len(timeline)} tweet(s), checking {len(to_check)} "
        f"({sum(1 for t in to_check if t.is_candidate)} heuristic article candidate(s))"
    )

    results: dict[str, list[str]] = {"created": [], "updated": [], "skipped": []}

    for timeline_tweet in to_check:
        await process_article(client, timeline_tweet, state, used_names, results)

    new_since_id = highest_tweet_id(timeline, state.get("since_id"))
    if new_since_id:
        state["since_id"] = new_since_id
    state["username"] = USERNAME
    state["sync_method"] = "twikit"
    state["last_synced_at"] = __import__("datetime").datetime.utcnow().isoformat() + "Z"

    if not DRY_RUN:
        save_state(ROOT, state)
        log("Updated .x-sync/state.json")
    else:
        log("DRY RUN: skipped writing .x-sync/state.json")

    log("--- Summary ---")
    log(f"Created: {len(results['created'])}" + (f" ({', '.join(results['created'])})" if results["created"] else ""))
    log(f"Updated: {len(results['updated'])}" + (f" ({', '.join(results['updated'])})" if results["updated"] else ""))
    log(f"Skipped: {len(results['skipped'])}")
    append_step_summary(results)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        print(f"[sync-x-articles] Failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
