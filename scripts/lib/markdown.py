"""Build blog Markdown files for synced X Articles."""

from __future__ import annotations

import hashlib
import re
import unicodedata
from typing import Any


def hash_content(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def slugify(title: str) -> str:
    normalized = unicodedata.normalize("NFKD", title)
    cleaned = re.sub(r"[^\w\s-]", "", normalized).strip()
    slug = re.sub(r"\s+", "-", cleaned)
    slug = re.sub(r"-+", "-", slug)
    return slug[:80]


def escape_yaml(value: str) -> str:
    return value.replace('"', '\\"')


def build_post_body(
    article: dict[str, Any],
    *,
    cover_image_path: str | None = None,
) -> str:
    sections: list[str] = []
    if cover_image_path:
        sections.extend([f"![Cover]({cover_image_path})", ""])

    sections.append(article["body_markdown"])
    sections.extend(
        [
            "",
            "---",
            "",
            f"_Originally published on [X]({article['url']})._",
        ]
    )
    return "\n".join(sections).strip()


def build_post_markdown(article: dict[str, Any], body: str) -> str:
    date = article["created_at"][:10]
    title = article["title"]
    return f"""---
title: "{escape_yaml(title)}"
date: {date}
source: {article["url"]}
source_id: "{article["tweet_id"]}"
tags: [X Article]
---

# {title}

{body}
"""


def build_filename(date: str, title: str, used_names: set[str]) -> str:
    base_slug = slugify(title) or "article"
    slug = base_slug
    counter = 2
    filename = f"{date}-{slug}.md"
    while filename in used_names:
        slug = f"{base_slug}-{counter}"
        filename = f"{date}-{slug}.md"
        counter += 1
    used_names.add(filename)
    return filename
