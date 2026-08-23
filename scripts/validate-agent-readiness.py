#!/usr/bin/env python3
"""Validate static agent-discoverability and sharing metadata before deployment."""

from __future__ import annotations

import re
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE = "https://zhangshi0512.github.io"
CARD = f"{SITE}/assets/social/shi-zhang-og-card.png"
PAGES = {
    "index.html": f"{SITE}/",
    "blog.html": f"{SITE}/blog.html",
    "projects.html": f"{SITE}/projects.html",
    "resume.html": f"{SITE}/resume.html",
    "biography.html": f"{SITE}/biography.html",
    "contact.html": f"{SITE}/contact.html",
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def attribute_values(html: str, tag: str, attribute: str, value: str) -> list[str]:
    pattern = rf"<{tag}\b[^>]*\b{attribute}=[\"']{re.escape(value)}[\"'][^>]*>"
    return re.findall(pattern, html, flags=re.IGNORECASE)


def has_meta(html: str, property_name: str, content: str | None = None) -> bool:
    tags = attribute_values(html, "meta", "property", property_name)
    if not tags:
        return False
    return content is None or any(
        re.search(rf"\bcontent=[\"']{re.escape(content)}[\"']", tag, flags=re.IGNORECASE)
        for tag in tags
    )


for filename, canonical_url in PAGES.items():
    html = (ROOT / filename).read_text(encoding="utf-8")
    require(
        any(canonical_url in tag for tag in attribute_values(html, "link", "rel", "canonical")),
        f"{filename}: canonical URL is missing or incorrect",
    )
    require(has_meta(html, "og:type", "website"), f"{filename}: og:type=website is missing")
    require(has_meta(html, "og:url", canonical_url), f"{filename}: og:url is missing or incorrect")
    require(has_meta(html, "og:title"), f"{filename}: og:title is missing")
    require(has_meta(html, "og:description"), f"{filename}: og:description is missing")
    require(has_meta(html, "og:image", CARD), f"{filename}: og:image is missing or incorrect")
    require(
        any("/llms.txt" in tag for tag in attribute_values(html, "link", "rel", "describedby")),
        f"{filename}: rel=describedby link to llms.txt is missing",
    )

llms = (ROOT / "llms.txt").read_text(encoding="utf-8")
for heading in ("## When to use this site", "## Agent-readable resources"):
    require(heading in llms, f"llms.txt: missing {heading}")
for resource in ("https://zhangshi0512.github.io/posts.json", "https://zhangshi0512.github.io/sitemap.xml"):
    require(resource in llms, f"llms.txt: missing {resource}")

not_found = (ROOT / "404.html").read_text(encoding="utf-8")
require('content="noindex, nofollow"' in not_found, "404.html: must not be indexed")
for href in ('href="/"', 'href="/llms.txt"', 'href="/sitemap.xml"'):
    require(href in not_found, f"404.html: missing recovery link {href}")

card = ROOT / "assets" / "social" / "shi-zhang-og-card.png"
require(card.is_file(), "Open Graph image is missing")
card_header = card.read_bytes()[:24]
require(card_header[:8] == b"\x89PNG\r\n\x1a\n", "Open Graph image is not a PNG")
card_width, card_height = struct.unpack(">II", card_header[16:24])
for filename in PAGES:
    html = (ROOT / filename).read_text(encoding="utf-8")
    require(
        has_meta(html, "og:image:width", str(card_width)),
        f"{filename}: og:image:width does not match the image",
    )
    require(
        has_meta(html, "og:image:height", str(card_height)),
        f"{filename}: og:image:height does not match the image",
    )

print(f"Agent-readiness metadata is valid for {len(PAGES)} public pages.")
