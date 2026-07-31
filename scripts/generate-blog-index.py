#!/usr/bin/env python3
"""Build the same-origin blog data file consumed by the static website."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "_posts"
OUTPUT_PATH = ROOT / "posts.json"


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


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate posts.json from _posts/*.md")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit with an error if posts.json is missing or out of date.",
    )
    args = parser.parse_args()

    payload = build_payload()
    rendered = serialize_payload(payload)
    post_count = len(payload["posts"])

    if args.check:
        existing = OUTPUT_PATH.read_text(encoding="utf-8") if OUTPUT_PATH.exists() else ""
        if existing != rendered:
            raise SystemExit("posts.json is out of date; run scripts/generate-blog-index.py")
        print(f"posts.json is up to date ({post_count} posts).")
        return

    OUTPUT_PATH.write_text(rendered, encoding="utf-8", newline="\n")
    print(f"Generated {OUTPUT_PATH.relative_to(ROOT)} ({post_count} posts).")


if __name__ == "__main__":
    main()
