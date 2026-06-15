"""Parse X Article bodies from Twikit GraphQL tweet payloads."""

from __future__ import annotations

import re
from typing import Any


def deep_get(data: Any, *keys: Any) -> Any:
    current = data
    for key in keys:
        if isinstance(key, int):
            if isinstance(current, list) and 0 <= key < len(current):
                current = current[key]
            else:
                return None
        elif isinstance(current, dict):
            current = current.get(key)
        else:
            return None
    return current


def unwrap_tweet_data(result: dict[str, Any]) -> dict[str, Any] | None:
    if result.get("__typename") == "TweetTombstone":
        return None
    if result.get("__typename") == "TweetWithVisibilityResults" and result.get("tweet"):
        return result["tweet"]
    if "legacy" in result and "core" in result:
        return result
    return None


def find_tweet_data(response: dict[str, Any]) -> dict[str, Any] | None:
    candidates = deep_get(response, "data", "tweetResult", "result")
    if isinstance(candidates, dict):
        return unwrap_tweet_data(candidates)

    # SearchTimeline / other shapes
    stack = [response]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            if node.get("__typename") in {"Tweet", "TweetWithVisibilityResults"} and "legacy" in node:
                unwrapped = unwrap_tweet_data(node)
                if unwrapped:
                    return unwrapped
            if "tweet" in node and isinstance(node["tweet"], dict):
                unwrapped = unwrap_tweet_data(node["tweet"])
                if unwrapped:
                    return unwrapped
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)
    return None


def _find_article_image_url(value: Any) -> str | None:
    if isinstance(value, dict):
        for key in (
            "original_img_url",
            "originalImgUrl",
            "original_url",
            "originalUrl",
            "media_url_https",
            "mediaUrlHttps",
            "media_url",
            "mediaUrl",
            "url",
            "src",
            "uri",
        ):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.strip():
                lowered = candidate.lower()
                if (
                    lowered.startswith("https://pbs.twimg.com/")
                    or lowered.endswith((".jpg", ".jpeg", ".png", ".gif", ".webp"))
                    or any(ext in lowered for ext in (".jpg?", ".jpeg?", ".png?", ".gif?", ".webp?"))
                ):
                    return candidate.strip()
        for nested in value.values():
            found = _find_article_image_url(nested)
            if found:
                return found
    elif isinstance(value, list):
        for item in value:
            found = _find_article_image_url(item)
            if found:
                return found
    return None


def _normalize_entity_map(entity_map: Any) -> dict[str, Any]:
    if isinstance(entity_map, dict):
        return {str(key): value for key, value in entity_map.items()}
    if isinstance(entity_map, list):
        normalized: dict[str, Any] = {}
        for item in entity_map:
            if not isinstance(item, dict):
                continue
            key = item.get("key")
            value = item.get("value")
            if key is None or value is None:
                continue
            normalized[str(key)] = value
        return normalized
    return {}


def _extract_article_media_url_map(article_results: dict[str, Any]) -> dict[str, str]:
    media_url_map: dict[str, str] = {}
    media_candidates: list[Any] = []
    cover_media = article_results.get("cover_media")
    if cover_media:
        media_candidates.append(cover_media)
    media_candidates.extend(article_results.get("media_entities") or [])

    for media in media_candidates:
        if not isinstance(media, dict):
            continue
        media_info = media.get("media_info") or {}
        image_url = _find_article_image_url(media_info) or _find_article_image_url(media)
        if not image_url:
            continue
        for key in ("media_id", "media_key", "id"):
            candidate = media.get(key)
            if isinstance(candidate, str) and candidate:
                media_url_map[candidate] = image_url
    return media_url_map


def _extract_atomic_markdown(block: dict[str, Any], entity_map: dict[str, Any]) -> list[str]:
    parts: list[str] = []
    for entity_range in block.get("entityRanges", []) or []:
        if not isinstance(entity_range, dict):
            continue
        entity_key = entity_range.get("key")
        entity = entity_map.get(str(entity_key)) if entity_key is not None else None
        if not isinstance(entity, dict):
            continue
        if str(entity.get("type") or "").upper() != "MARKDOWN":
            continue
        markdown = deep_get(entity, "data", "markdown")
        if isinstance(markdown, str) and markdown.strip():
            parts.append(markdown.strip())
    return parts


def _render_article_text_block(block: dict[str, Any], entity_map: dict[str, Any]) -> str:
    text = block.get("text", "")
    if not isinstance(text, str) or not text:
        return ""

    entity_ranges = block.get("entityRanges", []) or []
    if not entity_ranges:
        return text

    rendered = text
    ranges: list[tuple[int, int, str]] = []
    for entity_range in entity_ranges:
        if not isinstance(entity_range, dict):
            continue
        entity_key = entity_range.get("key")
        entity = entity_map.get(str(entity_key)) if entity_key is not None else None
        if not isinstance(entity, dict):
            continue
        if str(entity.get("type") or "").upper() != "LINK":
            continue
        offset = entity_range.get("offset")
        length = entity_range.get("length")
        if not isinstance(offset, int) or not isinstance(length, int) or length <= 0:
            continue
        url = deep_get(entity, "data", "url")
        if not isinstance(url, str) or not url.strip():
            continue
        ranges.append((offset, length, url.strip()))

    for offset, length, url in sorted(ranges, reverse=True):
        if offset < 0 or offset + length > len(rendered):
            continue
        label = rendered[offset : offset + length]
        if not label:
            continue
        safe_label = label.replace("[", "\\[").replace("]", "\\]")
        safe_url = url.replace(")", "%29")
        rendered = f"{rendered[:offset]}[{safe_label}]({safe_url}){rendered[offset + length :]}"

    return rendered


def _find_article_caption(value: Any) -> str | None:
    if isinstance(value, dict):
        for key in ("caption", "alt", "alt_text", "altText", "title", "name"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.strip():
                return candidate.strip()
        for nested in value.values():
            found = _find_article_caption(nested)
            if found:
                return found
    elif isinstance(value, list):
        for item in value:
            found = _find_article_caption(item)
            if found:
                return found
    return None


def _extract_article_images(
    block: dict[str, Any],
    entity_map: dict[str, Any],
    media_url_map: dict[str, str],
) -> list[str]:
    parts: list[str] = []
    for entity_range in block.get("entityRanges", []) or []:
        if not isinstance(entity_range, dict):
            continue
        entity_key = entity_range.get("key")
        entity = entity_map.get(str(entity_key)) if entity_key is not None else None
        if not isinstance(entity, dict):
            continue
        image_url = _find_article_image_url(entity)
        if not image_url:
            media_items = deep_get(entity, "data", "mediaItems") or []
            for media_item in media_items:
                media_id = media_item.get("mediaId") if isinstance(media_item, dict) else None
                if isinstance(media_id, str) and media_id in media_url_map:
                    image_url = media_url_map[media_id]
                    break
        if not image_url:
            continue
        caption = _find_article_caption(entity) or ""
        parts.append(f"![{caption}]({image_url})")
    return parts


def parse_article_from_tweet_data(tweet_data: dict[str, Any]) -> dict[str, Any] | None:
    article_results = deep_get(tweet_data, "article", "article_results", "result")
    if not isinstance(article_results, dict):
        return None

    title = (article_results.get("title") or "").strip() or None
    plain_text = (article_results.get("plain_text") or "").strip()

    content_state = article_results.get("content_state") or {}
    blocks = content_state.get("blocks") or []

    cover_url = _find_article_image_url(article_results.get("cover_media"))

    body_markdown = None
    if blocks:
        entity_map = _normalize_entity_map(content_state.get("entityMap", {}))
        media_url_map = _extract_article_media_url_map(article_results)
        parts: list[str] = []
        ordered_counter = 0
        for block in blocks:
            block_type = block.get("type", "unstyled")
            if block_type == "atomic":
                parts.extend(_extract_atomic_markdown(block, entity_map))
                parts.extend(_extract_article_images(block, entity_map, media_url_map))
                ordered_counter = 0
                continue
            text = _render_article_text_block(block, entity_map)
            if not text:
                continue
            if block_type != "ordered-list-item":
                ordered_counter = 0
            if block_type == "header-one":
                parts.append(f"# {text}")
            elif block_type == "header-two":
                parts.append(f"## {text}")
            elif block_type == "header-three":
                parts.append(f"### {text}")
            elif block_type == "blockquote":
                parts.append(f"> {text}")
            elif block_type == "unordered-list-item":
                parts.append(f"- {text}")
            elif block_type == "ordered-list-item":
                ordered_counter += 1
                parts.append(f"{ordered_counter}. {text}")
            elif block_type == "code-block":
                parts.append(f"```\n{text}\n```")
            else:
                parts.append(text)
        body_markdown = "\n\n".join(parts).strip() if parts else None

    if not body_markdown and plain_text:
        body_markdown = re.sub(r"\n{3,}", "\n\n", plain_text).strip()

    if not body_markdown or len(body_markdown) < 80:
        return None

    if not title:
        first_line = body_markdown.split("\n", 1)[0].lstrip("# ").strip()
        title = first_line[:120] if first_line else "Untitled Article"

    return {
        "title": title,
        "body_markdown": body_markdown,
        "cover_url": cover_url,
        "plain_text": plain_text or body_markdown,
    }


def extract_cover_from_thumbnail(tweet_data: dict[str, Any]) -> str | None:
    card = tweet_data.get("card") or {}
    legacy = card.get("legacy") or {}
    binding_values = legacy.get("binding_values") or []
    if isinstance(binding_values, list):
        bindings = {
            item.get("key"): item.get("value")
            for item in binding_values
            if isinstance(item, dict)
        }
        thumb = bindings.get("thumbnail_image_original") or bindings.get("summary_photo_image_original")
        if isinstance(thumb, dict):
            image_value = thumb.get("image_value") or {}
            url = image_value.get("url")
            if isinstance(url, str):
                return url
    return None
