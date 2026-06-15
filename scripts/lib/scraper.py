"""Twikit-based timeline polling and X Article fetching."""

from __future__ import annotations

import json
import os
import re
import traceback
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from .twikit_patch import apply_twikit_patches

apply_twikit_patches()

from twikit import Client
from twikit.client.gql import Endpoint
from twikit.constants import TWEET_RESULT_BY_REST_ID_FEATURES
from twikit.errors import NotFound, TooManyRequests
from twikit.tweet import Tweet

from .article_parser import (
    extract_cover_from_thumbnail,
    find_tweet_data,
    parse_article_from_tweet_data,
)

LogFn = Callable[[str], None]


def _default_log(message: str) -> None:
    print(f"[scraper] {message}")


@dataclass
class TimelineTweet:
    tweet_id: str
    created_at: str
    screen_name: str
    url: str
    is_candidate: bool


@dataclass
class ArticlePayload:
    tweet_id: str
    title: str
    body_markdown: str
    plain_text: str
    created_at: str
    url: str
    cover_url: str | None


def parse_cookie_json(raw: str) -> list[Any]:
    """Parse cookie JSON from env/secret; tolerate extra quoting or double-encoding."""
    text = raw.strip()
    if not text:
        raise RuntimeError("TWITTER_COOKIE_JSON is empty.")

    if (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
        text = json.loads(text)

    data = json.loads(text) if isinstance(text, str) else text
    if isinstance(data, str):
        data = json.loads(data)

    if not isinstance(data, list):
        raise RuntimeError("Cookie JSON must be a list of {name, value} objects.")

    return data


def load_cookie_map(*, log: LogFn = _default_log) -> dict[str, str]:
    cookie_json = os.environ.get("TWITTER_COOKIE_JSON")
    cookie_file = os.environ.get("TWITTER_COOKIE_FILE")

    if cookie_json:
        cookie_list = parse_cookie_json(cookie_json)
    elif cookie_file:
        cookie_list = parse_cookie_json(Path(cookie_file).read_text(encoding="utf-8"))
    else:
        raise RuntimeError(
            "Missing TWITTER_COOKIE_JSON (GitHub secret) or TWITTER_COOKIE_FILE (local path)."
        )

    cookie_map = {
        item["name"]: item["value"]
        for item in cookie_list
        if isinstance(item, dict) and "name" in item and "value" in item
    }

    for required in ("auth_token", "ct0"):
        if required not in cookie_map:
            raise RuntimeError(
                f"Cookie JSON is missing required cookie '{required}'. Re-export from x.com while logged in."
            )

    log(
        f"Loaded {len(cookie_map)} cookie(s): {', '.join(sorted(cookie_map))} "
        f"(auth_token/ct0 present)"
    )
    return cookie_map


def create_client(*, log: LogFn = _default_log) -> Client:
    cookies = load_cookie_map(log=log)
    client = Client("en-US")
    client.set_cookies(cookies)
    return client


def _tweet_screen_name(tweet: Tweet) -> str:
    user = tweet.user
    return getattr(user, "screen_name", None) or getattr(user, "username", "") or "i"


def _tweet_created_at_iso(tweet: Tweet) -> str:
    created = tweet.created_at
    if hasattr(created, "isoformat"):
        return created.isoformat()
    if isinstance(created, str):
        try:
            return datetime.strptime(created, "%a %b %d %H:%M:%S %z %Y").isoformat()
        except ValueError:
            return created
    return str(created)


def is_article_candidate(tweet: Tweet) -> bool:
    if tweet.thumbnail_title:
        return True

    card = tweet._data.get("card") or {}
    card_name = ((card.get("legacy") or {}).get("name") or "").lower()
    if "article" in card_name:
        return True

    if tweet.thumbnail_url and card_name:
        return True

    full_text = (tweet.full_text or tweet.text or "").strip()
    if not full_text:
        return False

    if len(full_text) <= 280 and re.search(r"https?://(t\.co/|x\.com/)", full_text):
        return bool(tweet.has_card)

    return False


def _result_len(batch: Any) -> int:
    try:
        return len(batch)
    except TypeError:
        return 0


async def verify_user_lookup(
    client: Client,
    username: str,
    *,
    log: LogFn = _default_log,
) -> str | None:
    """Return user id when lookup succeeds; log and return None otherwise."""
    try:
        user = await client.get_user_by_screen_name(username)
        user_id = str(user.id)
        screen_name = getattr(user, "screen_name", None) or getattr(user, "username", username)
        log(f"Resolved @{screen_name} -> user_id={user_id}")
        return user_id
    except Exception as exc:
        log(f"User lookup failed for @{username}: {type(exc).__name__}: {exc}")
        log(traceback.format_exc().rstrip())
        return None


async def fetch_recent_tweets(
    client: Client,
    username: str,
    *,
    max_count: int = 100,
    max_pages: int = 5,
    log: LogFn = _default_log,
) -> list[TimelineTweet]:
    rows: dict[str, TimelineTweet] = {}

    def add_tweet(tweet: Tweet) -> None:
        tweet_id = str(tweet.id)
        if tweet_id in rows:
            return
        screen_name = _tweet_screen_name(tweet)
        rows[tweet_id] = TimelineTweet(
            tweet_id=tweet_id,
            created_at=_tweet_created_at_iso(tweet),
            screen_name=screen_name,
            url=f"https://x.com/{screen_name}/status/{tweet_id}",
            is_candidate=is_article_candidate(tweet),
        )

    user_id = await verify_user_lookup(client, username, log=log)
    if user_id:
        try:
            batch = await client.get_user_tweets(user_id, "Tweets", count=min(40, max_count))
            pages = 0
            while pages < max_pages and len(rows) < max_count:
                page_count = _result_len(batch)
                log(f"Timeline page {pages + 1}: {page_count} tweet(s)")
                if page_count == 0:
                    break
                for tweet in batch:
                    add_tweet(tweet)
                    if len(rows) >= max_count:
                        break
                if len(rows) >= max_count:
                    break
                try:
                    batch = await batch.next()
                except Exception as exc:
                    log(f"Timeline pagination stopped: {type(exc).__name__}: {exc}")
                    break
                pages += 1
        except Exception as exc:
            log(f"Timeline fetch failed: {type(exc).__name__}: {exc}")
            log(traceback.format_exc().rstrip())

    if rows:
        ordered = sorted(rows.values(), key=lambda item: int(item.tweet_id))
        return ordered[-max_count:] if len(ordered) > max_count else ordered

    log("Timeline empty; trying search fallback (from:username)...")
    max_id: int | None = None
    pages = 0
    while len(rows) < max_count and pages < max_pages:
        query = f"from:{username}"
        if max_id is not None:
            query += f" max_id:{max_id}"
        try:
            batch = await client.search_tweet(query, "Latest")
        except NotFound as exc:
            log(f"Search returned NotFound for '{query}': {exc}")
            break
        except TooManyRequests as exc:
            log(f"Search rate-limited for '{query}': {exc}")
            break
        except Exception as exc:
            log(f"Search failed for '{query}': {type(exc).__name__}: {exc}")
            log(traceback.format_exc().rstrip())
            break

        page_count = _result_len(batch)
        log(f"Search page {pages + 1} ('{query}'): {page_count} tweet(s)")
        if page_count == 0:
            break

        ids: list[int] = []
        for tweet in batch:
            ids.append(int(tweet.id))
            add_tweet(tweet)
        if not ids:
            break
        max_id = min(ids) - 1
        pages += 1

    ordered = sorted(rows.values(), key=lambda item: int(item.tweet_id))
    return ordered[-max_count:] if len(ordered) > max_count else ordered


def timeline_from_tweet_ids(
    tweet_ids: list[str],
    *,
    username: str,
) -> list[TimelineTweet]:
    """Build timeline rows from explicit tweet IDs (bootstrap when timeline/search fail)."""
    rows: list[TimelineTweet] = []
    for tweet_id in tweet_ids:
        tweet_id = tweet_id.strip()
        if not tweet_id.isdigit():
            continue
        rows.append(
            TimelineTweet(
                tweet_id=tweet_id,
                created_at=datetime.utcnow().isoformat() + "Z",
                screen_name=username,
                url=f"https://x.com/{username}/status/{tweet_id}",
                is_candidate=True,
            )
        )
    return rows


async def fetch_article_payload(client: Client, tweet_id: str, fallback_url: str) -> ArticlePayload | None:
    variables = {
        "tweetId": tweet_id,
        "withCommunity": False,
        "includePromotedContent": False,
        "withVoice": False,
    }
    extra_params = {
        "fieldToggles": {
            "withArticleRichContentState": True,
            "withArticlePlainText": True,
            "withGrokAnalyze": False,
        }
    }

    response, _ = await client.gql.gql_get(
        Endpoint.TWEET_RESULT_BY_REST_ID,
        variables,
        TWEET_RESULT_BY_REST_ID_FEATURES,
        extra_params=extra_params,
    )

    tweet_data = find_tweet_data(response)
    if not tweet_data:
        return None

    parsed = parse_article_from_tweet_data(tweet_data)
    if not parsed:
        return None

    legacy = tweet_data.get("legacy") or {}
    created_at_raw = legacy.get("created_at")
    if isinstance(created_at_raw, str):
        try:
            created_at = datetime.strptime(created_at_raw, "%a %b %d %H:%M:%S %z %Y").isoformat()
        except ValueError:
            created_at = created_at_raw
    else:
        created_at = datetime.utcnow().isoformat() + "Z"

    user = ((tweet_data.get("core") or {}).get("user_results") or {}).get("result") or {}
    user_core = user.get("core") or {}
    user_legacy = user.get("legacy") or {}
    screen_name = user_core.get("screen_name") or user_legacy.get("screen_name") or "Simonsterrific"

    cover_url = parsed.get("cover_url") or extract_cover_from_thumbnail(tweet_data)

    return ArticlePayload(
        tweet_id=tweet_id,
        title=parsed["title"],
        body_markdown=parsed["body_markdown"],
        plain_text=parsed["plain_text"],
        created_at=created_at,
        url=f"https://x.com/{screen_name}/status/{tweet_id}",
        cover_url=cover_url,
    )


def filter_new_tweets(tweets: list[TimelineTweet], since_id: str | None) -> list[TimelineTweet]:
    if not since_id:
        return tweets
    since = int(since_id)
    return [tweet for tweet in tweets if int(tweet.tweet_id) > since]


def highest_tweet_id(tweets: list[TimelineTweet], current: str | None) -> str | None:
    ids = [int(tweet.tweet_id) for tweet in tweets]
    if current:
        ids.append(int(current))
    return str(max(ids)) if ids else current
