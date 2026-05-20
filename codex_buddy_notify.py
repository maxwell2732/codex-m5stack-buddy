#!/usr/bin/env python3
"""Codex notify bridge for Codex Buddy v0.1.

Codex invokes the configured notify command with one JSON string argument.
This script stores the raw event as JSONL and writes a normalized current
state file for local status displays and future hardware bridges.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parent
LOG_DIR = PROJECT_ROOT / "logs"
STATE_DIR = PROJECT_ROOT / "state"
EVENTS_LOG = LOG_DIR / "events.jsonl"
CURRENT_STATE = STATE_DIR / "current_state.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def pick(event: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in event:
            return event[key]
    return default


def normalize_messages(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def load_event(argv: list[str]) -> dict[str, Any]:
    if len(argv) < 2:
        raise ValueError("Usage: codex_buddy_notify.py '<NOTIFICATION_JSON>'")

    raw_event = " ".join(argv[1:])
    try:
        event = json.loads(raw_event)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid notification JSON: {exc}") from exc

    if not isinstance(event, dict):
        raise ValueError("Notification JSON must be an object")

    return event


def append_event(event: dict[str, Any]) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    with EVENTS_LOG.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False, separators=(",", ":")))
        handle.write("\n")


def build_state(event: dict[str, Any], updated_at: str) -> dict[str, Any]:
    event_type = pick(event, "type", "event_type", "event-type", default="unknown")
    return {
        "source": "codex",
        "state": "done",
        "event_type": event_type,
        "thread_id": pick(event, "thread-id", "thread_id"),
        "turn_id": pick(event, "turn-id", "turn_id"),
        "cwd": pick(event, "cwd", default=os.environ.get("CODEX_BUDDY_CWD", os.getcwd())),
        "last_assistant_message": pick(
            event,
            "last-assistant-message",
            "last_assistant_message",
            default="",
        ),
        "input_messages": normalize_messages(
            pick(event, "input-messages", "input_messages", default=[]),
        ),
        "updated_at": updated_at,
    }


def write_current_state(state: dict[str, Any]) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    temp_path = CURRENT_STATE.with_suffix(".json.tmp")
    temp_path.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temp_path.replace(CURRENT_STATE)


def main(argv: list[str]) -> int:
    try:
        event = load_event(argv)
        updated_at = utc_now()
        append_event(event)
        state = build_state(event, updated_at)
        write_current_state(state)
    except ValueError as exc:
        print(f"codex-buddy notify error: {exc}", file=sys.stderr)
        return 1
    except OSError as exc:
        print(f"codex-buddy filesystem error: {exc}", file=sys.stderr)
        return 1

    print(
        "Codex Buddy Bridge: "
        f"recorded {state['event_type']} turn={state['turn_id'] or 'unknown'}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
