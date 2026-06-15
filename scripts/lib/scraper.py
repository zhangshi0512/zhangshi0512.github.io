"""Twikit-based timeline polling and X Article fetching."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from .twikit_patch import apply_twikit_transaction_patch

apply_twikit_transaction_patch()

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


def load_cookie_map() -> dict[str, str]:
    cookie_json = os.environ.get("TWITTER_COOKIE_JSON")
    cookie_file = os.environ.get("TWITTER_COOKIE_FILE")

    if cookie_json:
        cookie_list = json.loads(cookie_json)
    elif cookie_file:
        cookie_list = json.loads(Path(cookie_file).read_text(encoding="utf-8"))
    else:
        raise RuntimeError(
            "Missing TWITTER_COOKIE_JSON (GitHub secret) or TWITTER_COOKIE_FILE (local path)."
        )

    if not isinstance(cookie_list, list):
        raise RuntimeError("Cookie JSON must be a list of {name, value} objects.")

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

    return cookie_map


def create_client() -> Client:
    cookies = load_cookie_map()
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


async def fetch_recent_tweets(
    client: Client,
    username: str,
    *,
    max_count: int = 30,
    max_pages: int = 3,
) -> list[TimelineTweet]:
    rows: dict[str, TimelineTweet] = {}
    max_id: int | None = None
    pages = 0

    while len(rows) < max_count and pages < max_pages:
        query = f"from:{username}"
        if max_id is not None:
            query += f" max_id:{max_id}"

        try:
            batch = await client.search_tweet(query, "Latest")
        except (NotFound, TooManyRequests):
            break

        if not batch:
            break

        ids: list[int] = []
        for tweet in batch:
            tweet_id = str(tweet.id)
            ids.append(int(tweet_id))
            if tweet_id in rows:
                continue

            screen_name = _tweet_screen_name(tweet)
            rows[tweet_id] = TimelineTweet(
                tweet_id=tweet_id,
                created_at=_tweet_created_at_iso(tweet),
                screen_name=screen_name,
                url=f"https://x.com/{screen_name}/status/{tweet_id}",
                is_candidate=is_article_candidate(tweet),
            )

        max_id = min(ids) - 1
        pages += 1

    ordered = sorted(rows.values(), key=lambda item: int(item.tweet_id))
    if len(ordered) > max_count:
        ordered = ordered[-max_count:]
    return ordered


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
