"""Download and mirror X Article images into the repo."""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse

import httpx


def _extension_from_url(url: str) -> str:
    try:
        path = urlparse(url).path
        match = re.search(r"(\.[a-zA-Z0-9]{2,5})(?:\?|$)", path)
        if match:
            return match.group(1)
    except Exception:
        pass
    return ".jpg"


def download_image(url: str, dest: Path) -> None:
    response = httpx.get(url, follow_redirects=True, timeout=30.0)
    response.raise_for_status()
    dest.write_bytes(response.content)


def mirror_cover_image(
    tweet_id: str,
    cover_url: str | None,
    assets_dir: Path,
    dry_run: bool = False,
) -> str | None:
    if not cover_url:
        return None

    assets_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{tweet_id}-cover{_extension_from_url(cover_url)}"
    local_path = assets_dir / filename
    web_path = f"assets/x-articles/{filename}"

    if not dry_run and not local_path.exists():
        download_image(cover_url, local_path)

    return web_path
