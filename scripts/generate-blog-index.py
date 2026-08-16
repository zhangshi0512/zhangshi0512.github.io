#!/usr/bin/env python3
"""Build the same-origin blog data file and sitemap consumed by the static website."""

from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "_posts"
OUTPUT_PATH = ROOT / "posts.json"
SITEMAP_PATH = ROOT / "sitemap.xml"
SITE_URL = "https://zhangshi0512.github.io"

# Public pages only. blog_dashboard.html is intentionally omitted (noindex).
STATIC_PAGES = (
    ("/", "index.html", "monthly", "1.0"),
    ("/blog.html", "blog.html", "weekly", "0.9"),
    ("/projects.html", "projects.html", "monthly", "0.8"),
    ("/resume.html", "resume.html", "monthly", "0.7"),
    ("/biography.html", "biography.html", "monthly", "0.7"),
    ("/contact.html", "contact.html", "monthly", "0.5"),
)


def build_payload() -> dict[str, object]:
    posts = []
    for path in sorted(POSTS_DIR.glob("*.md"), key=lambda item: item.name, reverse=True):
        posts.append(
            {
                "filename": path.name,
                "content": path.read_text(encoding="utf-8"),
            }
        )

    return {
        "version": 1,
        "posts": posts,
    }


def serialize_payload(payload: dict[str, object]) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def jekyll_permalink(filename: str) -> tuple[str, str]:
    """Map `_posts/YYYY-MM-DD-title.md` to GitHub Pages Jekyll post URLs."""
    stem = Path(filename).stem
    date_part = stem[:10]
    slug = stem[11:].replace(" ", "-")
    year, month, day = date_part.split("-")
    return f"{SITE_URL}/{year}/{month}/{day}/{slug}.html", date_part


def file_lastmod(relative: str) -> str:
    """Prefer git commit date so CI checkouts do not rewrite lastmod every run."""
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", relative],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        date = result.stdout.strip()
        if date:
            return date
    except (OSError, subprocess.CalledProcessError):
        pass

    path = ROOT / relative
    ts = path.stat().st_mtime
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")


def build_sitemap(payload: dict[str, object]) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]

    def add_url(loc: str, lastmod: str, changefreq: str, priority: str) -> None:
        lines.extend(
            [
                "  <url>",
                f"    <loc>{loc}</loc>",
                f"    <lastmod>{lastmod}</lastmod>",
                f"    <changefreq>{changefreq}</changefreq>",
                f"    <priority>{priority}</priority>",
                "  </url>",
            ]
        )

    posts = payload["posts"]
    latest_post_date = posts[0]["filename"][:10] if posts else None

    for path, filename, changefreq, priority in STATIC_PAGES:
        lastmod = file_lastmod(filename)
        if path == "/blog.html" and latest_post_date and latest_post_date > lastmod:
            lastmod = latest_post_date
        loc = SITE_URL if path == "/" else f"{SITE_URL}{path}"
        if path == "/":
            loc = f"{SITE_URL}/"
        add_url(loc, lastmod, changefreq, priority)

    for post in posts:
        loc, lastmod = jekyll_permalink(str(post["filename"]))
        add_url(loc, lastmod, "monthly", "0.8")

    lines.append("</urlset>")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate posts.json and sitemap.xml from _posts/*.md"
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit with an error if generated files are missing or out of date.",
    )
    args = parser.parse_args()

    payload = build_payload()
    rendered = serialize_payload(payload)
    sitemap = build_sitemap(payload)
    post_count = len(payload["posts"])

    if args.check:
        existing = OUTPUT_PATH.read_text(encoding="utf-8") if OUTPUT_PATH.exists() else ""
        existing_sitemap = (
            SITEMAP_PATH.read_text(encoding="utf-8") if SITEMAP_PATH.exists() else ""
        )
        errors = []
        if existing != rendered:
            errors.append("posts.json is out of date; run scripts/generate-blog-index.py")
        if existing_sitemap != sitemap:
            errors.append("sitemap.xml is out of date; run scripts/generate-blog-index.py")
        if errors:
            raise SystemExit("\n".join(errors))
        print(f"posts.json and sitemap.xml are up to date ({post_count} posts).")
        return

    OUTPUT_PATH.write_text(rendered, encoding="utf-8", newline="\n")
    SITEMAP_PATH.write_text(sitemap, encoding="utf-8", newline="\n")
    print(f"Generated {OUTPUT_PATH.relative_to(ROOT)} ({post_count} posts).")
    print(f"Generated {SITEMAP_PATH.relative_to(ROOT)}.")


if __name__ == "__main__":
    main()
