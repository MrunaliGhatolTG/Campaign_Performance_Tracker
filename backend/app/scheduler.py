"""The clock behind scheduled delivery.

One asyncio task, started with the app, wakes every TICK_SECONDS, asks whether
the saved schedule is due in its own timezone, and sends the brief at most once
per local day. `assess()` is the whole decision and is pure, so /api/digest/status
can report exactly what the loop is about to do.

A missed slot is caught up for DIGEST_CATCHUP_MINUTES (default 120). Past that
the day is treated as missed rather than firing a "morning" brief at midnight,
and nothing is recorded, so the next scheduled day behaves normally.

This assumes ONE process. Run uvicorn with several workers and each keeps its
own clock and sends its own copy; that deployment wants an external cron calling
POST /api/digest/send-now, or a lock in the store.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from . import digest, mailer, schedule as schedule_store

log = logging.getLogger("cpt.scheduler")

TICK_SECONDS = 30
DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name) or default)
    except ValueError:
        return default


def catchup_minutes() -> int:
    return _int_env("DIGEST_CATCHUP_MINUTES", 120)


def zone(name: str | None) -> ZoneInfo:
    """The schedule's timezone, or UTC if it names one this box cannot resolve."""
    try:
        return ZoneInfo(name or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        log.warning("Unknown timezone %r; using UTC instead.", name)
        return ZoneInfo("UTC")


def _at(sched: dict, day: datetime) -> datetime:
    """`day` moved to the schedule's wall-clock time."""
    hh, _, mm = (sched.get("time") or "07:30").partition(":")
    try:
        hour, minute = int(hh), int(mm)
    except ValueError:
        hour, minute = 7, 30
    return day.replace(hour=hour, minute=minute, second=0, microsecond=0)


def _sent_on(last_sent: str | None, tz: ZoneInfo, day) -> bool:
    if not last_sent:
        return False
    try:
        when = datetime.fromisoformat(last_sent)
    except (TypeError, ValueError):
        return False
    if when.tzinfo is None:
        when = when.replace(tzinfo=tz)
    return when.astimezone(tz).date() == day


def _next_due(sched: dict, now_local: datetime) -> datetime | None:
    days = sched.get("days") or []
    if not days:
        return None
    for ahead in range(0, 9):
        candidate = _at(sched, now_local + timedelta(days=ahead))
        if candidate > now_local and DAY_KEYS[candidate.weekday()] in days:
            return candidate
    return None


def assess(sched: dict | None = None, now: datetime | None = None) -> dict:
    """Whether the brief is due, and in plain words why or why not."""
    sched = schedule_store.read() if sched is None else sched
    tz = zone(sched.get("timezone"))
    now_local = now.astimezone(tz) if now else datetime.now(tz)

    due_at = _at(sched, now_local)
    next_due = _next_due(sched, now_local)
    sent_today = _sent_on(sched.get("last_sent"), tz, now_local.date())

    verdict = {
        "due": False,
        "reason": "",
        "timezone": str(tz),
        "now_local": now_local.isoformat(timespec="seconds"),
        "due_at_local": due_at.isoformat(timespec="seconds"),
        "next_due_local": next_due.isoformat(timespec="seconds") if next_due else None,
        "already_sent_today": sent_today,
        "catchup_minutes": catchup_minutes(),
    }

    if not sched.get("enabled"):
        return {**verdict, "reason": "The schedule is switched off."}
    if not (sched.get("recipients") or []):
        return {**verdict, "reason": "The schedule has no recipients."}
    if not (sched.get("days") or []):
        return {**verdict, "reason": "No days are selected, so it will never send."}
    if DAY_KEYS[now_local.weekday()] not in sched["days"]:
        return {**verdict, "reason": f"{DAY_KEYS[now_local.weekday()]} is not a scheduled day."}
    if sent_today:
        return {**verdict, "reason": "Already sent today."}
    if now_local < due_at:
        return {**verdict, "reason": f"Waiting for {sched.get('time')} {verdict['timezone']}."}
    if now_local > due_at + timedelta(minutes=catchup_minutes()):
        return {
            **verdict,
            "reason": (
                f"Today's slot was missed by more than {catchup_minutes()} minutes; "
                "waiting for the next scheduled day."
            ),
        }

    return {**verdict, "due": True, "reason": "Due now."}


def send_now(sched: dict | None = None, *, scheduled: bool = False) -> dict:
    """Build and send the brief immediately, then record it. Raises on failure.

    `scheduled=True` is the loop's own send and claims the day. A manual send
    is recorded separately, so testing delivery never costs a real brief.
    """
    sched = schedule_store.read() if sched is None else sched
    recipients = list(sched.get("recipients") or [])

    subject, html, text = digest.build_brief(sched)
    result = mailer.send(subject, html, text, recipients)

    tz = zone(sched.get("timezone"))
    sent_at = datetime.now(tz).isoformat(timespec="seconds")
    if scheduled:
        schedule_store.mark_sent(sent_at)
    else:
        schedule_store.mark_manual_sent(sent_at)

    log.info(
        "Morning brief sent to %s (%s).",
        ", ".join(recipients),
        "scheduled" if scheduled else "manual",
    )
    return {
        "sent": True,
        "scheduled": scheduled,
        "subject": subject,
        "sent_at": sent_at,
        **result,
    }


def tick() -> dict:
    """One pass of the loop. Safe to call by hand; it only acts when due."""
    sched = schedule_store.read()
    verdict = assess(sched)

    if not verdict["due"]:
        return verdict

    if not mailer.configured():
        schedule_store.mark_error(
            "The brief was due but SMTP_HOST is not set, so no mail could be sent."
        )
        log.warning("Brief is due but SMTP is not configured; see /api/digest/status.")
        return {**verdict, "sent": False, "error": "SMTP is not configured."}

    try:
        return {**verdict, **send_now(sched, scheduled=True)}
    except Exception as exc:  # recorded, then retried on the next tick
        schedule_store.mark_error(f"{type(exc).__name__}: {exc}")
        log.exception("Sending the morning brief failed.")
        return {**verdict, "sent": False, "error": f"{type(exc).__name__}: {exc}"}


async def run_forever() -> None:
    log.info("Delivery scheduler started; checking every %ss.", TICK_SECONDS)
    while True:
        try:
            # SMTP and the file store both block, so keep them off the event loop.
            await asyncio.to_thread(tick)
        except asyncio.CancelledError:
            log.info("Delivery scheduler stopped.")
            raise
        except Exception:
            log.exception("Scheduler tick failed; carrying on.")
        await asyncio.sleep(TICK_SECONDS)
