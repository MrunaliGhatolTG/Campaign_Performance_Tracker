"""The delivery schedule, stored as a JSON file beside the app.

Swap `_PATH` for a table when this moves to a real database; the shape the
frontend sends and expects back is the whole contract.

`last_sent`, `last_manual_sent` and `last_error` are the server's own
bookkeeping and the client never writes them. `last_sent` is the scheduler's
alone: it is what stops a second copy going out on the same local day, so a
manual test send is recorded separately as `last_manual_sent` and does not
cancel that day's scheduled brief. `last_error` is why the last attempt failed.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_PATH = Path(__file__).resolve().parent.parent / "data" / "schedule.json"

DEFAULT: dict[str, Any] = {
    "enabled": True,
    "time": "07:30",
    "timezone": "Africa/Lagos",
    "days": ["mon", "tue", "wed", "thu", "fri"],
    "recipients": ["campaign.team@example.com"],
    "brand": "all",
    "alerts": ["low-ctr"],
    "last_sent": None,
    "last_manual_sent": None,
    "last_error": None,
}


def read() -> dict[str, Any]:
    if not _PATH.exists():
        return dict(DEFAULT)
    try:
        return {**DEFAULT, **json.loads(_PATH.read_text())}
    except (json.JSONDecodeError, OSError):
        return dict(DEFAULT)


def _save(schedule: dict[str, Any]) -> dict[str, Any]:
    _PATH.parent.mkdir(parents=True, exist_ok=True)
    _PATH.write_text(json.dumps(schedule, indent=2))
    return schedule


def write(schedule: dict[str, Any]) -> dict[str, Any]:
    current = read()
    # these three are the server's to set, never the client's
    merged = {
        **current,
        **schedule,
        "last_sent": current.get("last_sent"),
        "last_manual_sent": current.get("last_manual_sent"),
        "last_error": current.get("last_error"),
    }
    return _save(merged)


def mark_sent(when: str) -> dict[str, Any]:
    """Record the scheduled send for the day, which also clears the last failure."""
    current = read()
    current["last_sent"] = when
    current["last_error"] = None
    return _save(current)


def mark_manual_sent(when: str) -> dict[str, Any]:
    """Record a send-now. Deliberately leaves `last_sent` alone: a test send
    proves the wiring works and must not cancel the day's scheduled brief."""
    current = read()
    current["last_manual_sent"] = when
    current["last_error"] = None
    return _save(current)


def mark_error(message: str | None) -> dict[str, Any]:
    """Record why a send failed, or clear it with None. Writes only on change."""
    current = read()
    if current.get("last_error") == message:
        return current
    current["last_error"] = message
    return _save(current)
