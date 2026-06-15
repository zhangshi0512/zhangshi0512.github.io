"""Load and persist .x-sync/state.json."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

STATE_DIR = ".x-sync"
STATE_FILE = "state.json"


def default_state(username: str) -> dict[str, Any]:
    return {
        "username": username,
        "user_id": None,
        "since_id": None,
        "last_synced_at": None,
        "sync_method": "twikit",
        "articles": {},
    }


def state_path(root: Path) -> Path:
    return root / STATE_DIR / STATE_FILE


def load_state(root: Path, username: str) -> dict[str, Any]:
    path = state_path(root)
    if not path.exists():
        return default_state(username)
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
        state = default_state(username)
        state.update(parsed)
        state["articles"] = parsed.get("articles") or {}
        return state
    except (json.JSONDecodeError, OSError):
        return default_state(username)


def save_state(root: Path, state: dict[str, Any]) -> None:
    path = state_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
