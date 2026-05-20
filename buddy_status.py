#!/usr/bin/env python3
"""Terminal status panel for Codex Buddy v0.1."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from textwrap import shorten
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parent
CURRENT_STATE = PROJECT_ROOT / "state" / "current_state.json"


def read_state() -> dict[str, Any] | None:
    if not CURRENT_STATE.exists():
        return None
    with CURRENT_STATE.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError("current_state.json must contain a JSON object")
    return data


def line(label: str, value: Any, width: int = 66) -> str:
    text = "" if value is None else str(value)
    content = f"{label:<12} {shorten(text, width=width - 16, placeholder='...')}"
    return f"| {content:<{width - 4}} |"


def render_empty() -> str:
    return "\n".join(
        [
            "+----------------------------------------------------------------+",
            "| Codex Buddy                                                    |",
            "+----------------------------------------------------------------+",
            "|  z_Z                                                           |",
            "| ( -.- )  No state yet. Run scripts/test_notify.ps1 first.      |",
            "+----------------------------------------------------------------+",
        ]
    )


def render_state(state: dict[str, Any]) -> str:
    input_messages = state.get("input_messages") or []
    if isinstance(input_messages, list):
        input_text = " | ".join(str(item) for item in input_messages)
    else:
        input_text = str(input_messages)

    face = "( ^_^ )" if state.get("state") == "done" else "( o_o )"

    rows = [
        "+----------------------------------------------------------------+",
        "| Codex Buddy                                                    |",
        "+----------------------------------------------------------------+",
        f"| {face:<62} |",
        line("state", state.get("state")),
        line("event", state.get("event_type")),
        line("thread", state.get("thread_id")),
        line("turn", state.get("turn_id")),
        line("cwd", state.get("cwd")),
        line("updated", state.get("updated_at")),
        line("input", input_text),
        line("assistant", state.get("last_assistant_message")),
        "+----------------------------------------------------------------+",
    ]
    return "\n".join(rows)


def main() -> int:
    try:
        state = read_state()
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"Codex Buddy status error: {exc}", file=sys.stderr)
        return 1

    print(render_state(state) if state else render_empty())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
