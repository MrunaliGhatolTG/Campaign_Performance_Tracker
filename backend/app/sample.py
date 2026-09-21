"""A deterministic sample dataset, standing in for the Fabric gold table.

Every figure here is invented. The shape is what matters: one row per ad set
per day, with the columns the real table has, so replacing this module with a
SQL query against dbo.meta_all_brands_gold is the only change needed to go
live. `daily_rows()` is the seam.
"""

from __future__ import annotations

import random
from datetime import date, timedelta

WINDOW_DAYS = 14
# Ad platforms report a day behind, so the newest complete day is yesterday.
REPORTING_LAG_DAYS = 1


def latest_date() -> date:
    """The newest day the dataset covers, always relative to today."""
    return date.today() - timedelta(days=REPORTING_LAG_DAYS)

BRANDS = [
    "Indomie",
    "Nutrify",
    "Lush",
    "Colgate",
    "Hypo",
    "Power Oil",
    "Minimie",
    "Munch It",
    "Addme",
    "Kellogg's",
]

OBJECTIVES = [
    "OUTCOME_AWARENESS",
    "OUTCOME_REACH",
    "OUTCOME_ENGAGEMENT",
    "OUTCOME_TRAFFIC",
]

PLATFORMS = ["facebook", "instagram"]

REGIONS = ["Lagos", "Nationwide", "SouthWest", "SouthEast", "Abuja", "Kano"]

CREATIVES = [
    "Reels 20s | Jollof recipe",
    "Reels 15s | Mum & child",
    "Static | Shelf takeover",
    "Story | Price drop",
    "Static | Market stall",
    "Reels 10s | Chin chin",
    "Static | Pack shot naira price",
    "Story | Chef cameo",
    "Reels 15s | School morning",
    "Static | Retailer testimonial",
]


def _objective_word(objective: str) -> str:
    return objective.replace("OUTCOME_", "").title()


def _ad_sets(seed: int = 20260830) -> list[dict]:
    """The ad sets themselves, with the performance profile each one keeps."""
    rng = random.Random(seed)
    rows: list[dict] = []

    for b, brand in enumerate(BRANDS):
        for i in range(rng.randint(2, 4)):
            objective = OBJECTIVES[(b + i) % len(OBJECTIVES)]
            region = REGIONS[(b + i * 3) % len(REGIONS)]

            rows.append(
                {
                    "brand": brand,
                    "objective": objective,
                    "campaign_id": f"2385914{400 + b * 4 + i}",
                    "campaign_name": (
                        f"{brand.replace(' ', '').replace(chr(39), '')}"
                        f"_{_objective_word(objective)}_{region}"
                    ),
                    "ad_id": f"12021748{1000 + b * 10 + i}",
                    "ad_name": CREATIVES[(b * 3 + i) % len(CREATIVES)],
                    "platform": PLATFORMS[(b + i) % len(PLATFORMS)],
                    # the profile: how this ad set performs before daily noise
                    "base_impressions": rng.randint(4_000, 48_000),
                    "base_ctr": round(rng.uniform(0.35, 3.4), 3),
                    "base_engagement": round(rng.uniform(0.6, 4.2), 3),
                    "reach_share": round(rng.uniform(0.45, 0.85), 3),
                    "cpm": round(rng.uniform(3.2, 11.5), 2),
                    # most hold steady; a few fade hard and a couple drift,
                    # which is what the fatigue alert is there to separate
                    "decay": rng.choice([1.0] * 6 + [0.52, 0.61, 0.87, 0.91]),
                }
            )

    return rows


AD_SETS = _ad_sets()


def daily_rows(latest: date | None = None, days: int = WINDOW_DAYS) -> list[dict]:
    """One row per ad set per day — the grain of the gold table."""
    latest = latest_date() if latest is None else latest
    # A fixed seed, so the figures for a given ad set never jump between
    # requests even though the dates move with the calendar.
    rng = random.Random(7)
    out: list[dict] = []
    start = latest - timedelta(days=days - 1)

    for ad in AD_SETS:
        for offset in range(days):
            day = start + timedelta(days=offset)
            # decay applies over the last three days only
            fading = offset >= days - 3
            factor = ad["decay"] if fading else 1.0
            noise = rng.uniform(0.88, 1.12)

            impressions = int(ad["base_impressions"] * noise)
            ctr = ad["base_ctr"] * factor * rng.uniform(0.92, 1.08)
            clicks = int(impressions * ctr / 100)
            engagement_rate = ad["base_engagement"] * factor * rng.uniform(0.9, 1.1)

            out.append(
                {
                    "date": day.isoformat(),
                    "brand": ad["brand"],
                    "objective": ad["objective"],
                    "campaign_id": ad["campaign_id"],
                    "campaign_name": ad["campaign_name"],
                    "ad_id": ad["ad_id"],
                    "ad_name": ad["ad_name"],
                    "platform": ad["platform"],
                    "impressions": impressions,
                    "clicks": clicks,
                    "reach": int(impressions * ad["reach_share"]),
                    "engagements": int(impressions * engagement_rate / 100),
                    "spend": round(impressions / 1000 * ad["cpm"], 2),
                }
            )

    return out


_cache: tuple[date, list[dict]] | None = None


def rows() -> list[dict]:
    """The dataset, rebuilt when the calendar day rolls over.

    Cached so repeated requests see identical figures, but keyed on the latest
    day: a server left running overnight then reports the new day instead of
    freezing on the day it booted.
    """
    global _cache
    day = latest_date()
    if _cache is None or _cache[0] != day:
        _cache = (day, daily_rows(day, WINDOW_DAYS))
    return _cache[1]


def brands() -> list[str]:
    return sorted({r["brand"] for r in rows()})


def platforms() -> list[str]:
    return sorted({r["platform"] for r in rows()})


def rows_for(day: str | None = None, brand: str = "all", platform: str = "all") -> list[dict]:
    """The slice an endpoint works on."""
    out = rows()
    if day:
        out = [r for r in out if r["date"] == day]
    if brand and brand != "all":
        out = [r for r in out if r["brand"].lower() == brand.lower()]
    if platform and platform != "all":
        out = [r for r in out if r["platform"] == platform]
    return out


def latest_day() -> str:
    return latest_date().isoformat()
