"""Campaign Performance Tracker — sample API.

Serves the endpoints the frontend calls, computed from an invented dataset in
app/sample.py. Nothing here touches Fabric: replacing `sample.rows_for` with a
SQL query against dbo.meta_all_brands_gold is the whole migration.

    uvicorn app.main:app --reload
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from . import alerts, digest, mailer, sample, schedule as schedule_store, scheduler
from .benchmarks import METRICS

# The scheduler logs through a plain logger; uvicorn configures only its own,
# so give the root one a handler or these messages would go nowhere.
logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s %(message)s")


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    """Run the delivery scheduler for as long as the app is up."""
    task = asyncio.create_task(scheduler.run_forever())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title="Campaign Performance Tracker — sample API",
    description="Sample data. Every figure is invented.",
    version="0.1.0",
    lifespan=_lifespan,
)

# The Vite dev server runs on another port; a built frontend is same-origin and
# needs none of this.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PLATFORM_LABELS = {
    "facebook": "Facebook",
    "instagram": "Instagram",
}


class Schedule(BaseModel):
    enabled: bool = True
    time: str = Field(pattern=r"^\d{2}:\d{2}$")
    timezone: str
    days: list[str]
    recipients: list[str]
    brand: str = "all"
    alerts: list[str] = ["low-ctr"]

    @field_validator("days")
    @classmethod
    def known_days(cls, v: list[str]) -> list[str]:
        allowed = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
        unknown = [d for d in v if d not in allowed]
        if unknown:
            raise ValueError(f"unknown days: {', '.join(unknown)}")
        return v

    @field_validator("recipients")
    @classmethod
    def look_like_emails(cls, v: list[str]) -> list[str]:
        bad = [r for r in v if "@" not in r or "." not in r.split("@")[-1]]
        if bad:
            raise ValueError(f"not an email address: {', '.join(bad)}")
        return v


@app.get("/api/brands")
def get_brands() -> dict[str, Any]:
    names = sample.brands()
    return {
        "brands": [{"key": "all", "label": "All brands"}]
        + [{"key": b, "label": b} for b in names],
        "default": "all",
        "entity_label": alerts.ENTITY_LABEL,
        "table": alerts.TABLE,
    }


@app.get("/api/platforms")
def get_platforms() -> dict[str, Any]:
    return {
        "available": True,
        "platforms": [{"key": "all", "label": "All platforms"}]
        + [{"key": p, "label": PLATFORM_LABELS.get(p, p)} for p in sample.platforms()],
    }


@app.get("/api/thresholds")
def get_thresholds() -> dict[str, Any]:
    return {
        "defaults": alerts.default_thresholds(),
        "metrics": [
            {"key": k, "label": m.label, "default": m.default_threshold}
            for k, m in METRICS.items()
        ],
    }


@app.get("/api/alerts/low-ctr")
def get_low_ctr(
    brand: str = "all",
    platform: str = "all",
    threshold_ctr: float | None = None,
    threshold_engagement_rate: float | None = None,
    threshold_reach: float | None = None,
    threshold_pct: float | None = None,
    threshold_mode: str = "by_objective",
    ctr_scale: str = "auto",
) -> dict[str, Any]:
    """Every ad set against the benchmark for its own objective."""
    defaults = alerts.default_thresholds()
    thresholds = {
        "ctr": threshold_ctr if threshold_ctr is not None else (threshold_pct or defaults["ctr"]),
        "engagement_rate": threshold_engagement_rate
        if threshold_engagement_rate is not None
        else defaults["engagement_rate"],
        "reach": threshold_reach if threshold_reach is not None else defaults["reach"],
    }

    if any(v < 0 for v in thresholds.values()):
        raise HTTPException(status_code=422, detail="Thresholds cannot be negative.")

    return alerts.low_ctr(brand=brand, platform=platform, thresholds=thresholds)


@app.get("/api/alerts/creative-fatigue")
def get_creative_fatigue(
    brand: str = "all",
    platform: str = "all",
    min_decline_pct: float = Query(25, ge=0, le=100),
) -> dict[str, Any]:
    """Ad sets whose CTR has really fallen against their own baseline."""
    return alerts.creative_fatigue(
        brand=brand, platform=platform, min_decline_pct=min_decline_pct
    )


@app.get("/api/digest/schedule")
def get_schedule() -> dict[str, Any]:
    return schedule_store.read()


@app.put("/api/digest/schedule")
def put_schedule(schedule: Schedule) -> dict[str, Any]:
    return schedule_store.write(schedule.model_dump())


@app.get("/api/digest/preview", response_class=HTMLResponse)
def get_digest_preview() -> HTMLResponse:
    """The morning brief as an email client would render it."""
    _subject, html, _text = digest.build_brief(schedule_store.read())
    return HTMLResponse(html)


@app.get("/api/digest/status")
def get_digest_status() -> dict[str, Any]:
    """Whether the brief will go out, and what is stopping it if not."""
    current = schedule_store.read()
    return {
        "mail": mailer.settings(),
        "schedule": scheduler.assess(current),
        "last_sent": current.get("last_sent"),
        "last_manual_sent": current.get("last_manual_sent"),
        "last_error": current.get("last_error"),
        "tick_seconds": scheduler.TICK_SECONDS,
    }


@app.post("/api/digest/send-now")
def post_digest_send_now() -> dict[str, Any]:
    """Send the brief now, to the saved recipients. For proving delivery works."""
    current = schedule_store.read()
    if not (current.get("recipients") or []):
        raise HTTPException(status_code=422, detail="The schedule has no recipients.")

    try:
        return scheduler.send_now(current)
    except mailer.MailNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        schedule_store.mark_error(f"{type(exc).__name__}: {exc}")
        raise HTTPException(status_code=502, detail=f"{type(exc).__name__}: {exc}") from exc


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "rows": len(sample.rows()), "latest_day": sample.latest_day()}


# A built frontend, if one has been copied in. Mounted last so /api wins.
_STATIC = Path(__file__).resolve().parent.parent / "static"
if (_STATIC / "index.html").exists():
    app.mount("/", StaticFiles(directory=_STATIC, html=True), name="ui")
