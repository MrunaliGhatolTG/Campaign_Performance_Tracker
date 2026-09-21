"""The two alerts, computed from whatever `sample.rows_for` returns."""

from __future__ import annotations

import math
from collections import defaultdict

from . import sample
from .benchmarks import METRICS, message_for, metric_for, objective_label, reading_of

ENTITY_LABEL = "Ad set"
TABLE = "dbo.meta_all_brands_gold (sample)"


def _aggregate(rows: list[dict]) -> list[dict]:
    """Day rows -> one row per ad set, with the three metrics derived."""
    by_ad: dict[str, dict] = {}

    for r in rows:
        acc = by_ad.setdefault(
            r["ad_id"],
            {
                "brand": r["brand"],
                "objective": r["objective"],
                "campaign_id": r["campaign_id"],
                "campaign_name": r["campaign_name"],
                "ad_id": r["ad_id"],
                "ad_name": r["ad_name"],
                "platform": r["platform"],
                "impressions": 0,
                "clicks": 0,
                "reach": 0,
                "engagements": 0,
                "spend": 0.0,
            },
        )
        for field in ("impressions", "clicks", "reach", "engagements"):
            acc[field] += r[field]
        acc["spend"] += r["spend"]

    out = []
    for acc in by_ad.values():
        impressions = acc["impressions"] or 1
        acc["spend"] = round(acc["spend"], 2)
        acc["ctr"] = round(acc["clicks"] / impressions * 100, 3)
        acc["engagement_rate"] = round(acc["engagements"] / impressions * 100, 3)
        out.append(acc)

    return out


def low_ctr(
    *,
    brand: str,
    platform: str,
    thresholds: dict[str, float],
) -> dict:
    """Every ad set on the latest day, against the benchmark for its objective."""
    day = sample.latest_day()
    rows = _aggregate(sample.rows_for(day=day, brand=brand, platform=platform))

    findings, distribution = [], []
    impressions = clicks = 0
    spend_flagged = 0.0

    for row in sorted(rows, key=lambda r: r["ad_id"]):
        reading = reading_of(row, thresholds)
        impressions += row["impressions"]
        clicks += row["clicks"]

        distribution.append(
            {
                "ad_id": row["ad_id"],
                "objective": row["objective"],
                "metric": reading["metric"],
                "value": reading["value"],
                "threshold": reading["threshold"],
                "ctr": row["ctr"],
                "status": "ALERT" if reading["below"] else "OK",
            }
        )

        if reading["below"]:
            spend_flagged += row["spend"]
            findings.append(
                {
                    **{k: row[k] for k in (
                        "brand", "campaign_id", "campaign_name", "ad_id",
                        "ad_name", "impressions", "clicks", "spend",
                    )},
                    "objective": row["objective"],
                    "objective_label": objective_label(row["objective"]),
                    "period": day,
                    "metric": reading["metric"],
                    "value": reading["value"],
                    "threshold": reading["threshold"],
                    "ratio_pct": reading["ratio_pct"],
                    "ctr": row["ctr"],
                    "threshold_pct": thresholds["ctr"],
                    "message": message_for(row, reading),
                }
            )

    findings.sort(key=lambda f: f["ratio_pct"] if f["ratio_pct"] is not None else 0)

    return {
        "mode": "benchmark",
        "table": TABLE,
        "brand": brand,
        "brand_label": "All brands" if brand == "all" else brand,
        "brand_source": "brand column",
        "platform": platform,
        "platform_label": "All platforms" if platform == "all" else platform,
        "platform_available": True,
        "entity_label": ENTITY_LABEL,
        "period": day,
        "threshold_mode": "by_objective",
        "threshold_pct": thresholds["ctr"],
        "thresholds": thresholds,
        "ctr_unit_detected": "percent",
        "ctr_mismatches": 0,
        "ads_evaluated": len(rows),
        "ads_alerting": len(findings),
        "portfolio_ctr": round(clicks / (impressions or 1) * 100, 2),
        "spend_on_alerting_ads": round(spend_flagged, 2),
        "weakest_ctr": min((r["ctr"] for r in rows), default=None),
        "findings": findings,
        "distribution": distribution,
    }


def _p_value(c1: int, i1: int, c2: int, i2: int) -> float:
    """Two-proportion z-test, normal approximation. No scipy needed."""
    if not i1 or not i2:
        return 1.0

    p1, p2 = c1 / i1, c2 / i2
    pooled = (c1 + c2) / (i1 + i2)
    se = math.sqrt(pooled * (1 - pooled) * (1 / i1 + 1 / i2))
    if se == 0:
        return 1.0

    z = abs(p1 - p2) / se
    return round(math.erfc(z / math.sqrt(2)), 5)


def creative_fatigue(
    *,
    brand: str,
    platform: str,
    min_decline_pct: float,
    recent_days: int = 3,
    min_impressions_each: int = 1000,
    max_p_value: float = 0.05,
) -> dict:
    """Ad sets whose CTR has really fallen against their own baseline."""
    all_rows = sample.rows_for(brand=brand, platform=platform)
    days = sorted({r["date"] for r in all_rows})
    recent_days_set = set(days[-recent_days:])
    baseline_days = [d for d in days if d not in recent_days_set]

    recent = defaultdict(lambda: {"impressions": 0, "clicks": 0, "spend": 0.0})
    baseline = defaultdict(lambda: {"impressions": 0, "clicks": 0})
    meta: dict[str, dict] = {}

    for r in all_rows:
        meta.setdefault(r["ad_id"], r)
        bucket = recent[r["ad_id"]] if r["date"] in recent_days_set else baseline[r["ad_id"]]
        bucket["impressions"] += r["impressions"]
        bucket["clicks"] += r["clicks"]
        if r["date"] in recent_days_set:
            recent[r["ad_id"]]["spend"] += r["spend"]

    findings, watchlist, distribution = [], [], []
    skipped = 0
    spend_at_risk = 0.0

    for ad_id, info in meta.items():
        rec, base = recent[ad_id], baseline[ad_id]
        if rec["impressions"] < min_impressions_each or base["impressions"] < min_impressions_each:
            skipped += 1
            continue

        ctr_recent = rec["clicks"] / rec["impressions"] * 100
        ctr_baseline = base["clicks"] / base["impressions"] * 100
        decline = (ctr_baseline - ctr_recent) / ctr_baseline * 100 if ctr_baseline else 0.0
        p = _p_value(rec["clicks"], rec["impressions"], base["clicks"], base["impressions"])

        significant = p <= max_p_value
        if significant and decline >= min_decline_pct:
            status = "FATIGUED"
        elif significant and decline > 0:
            status = "WATCH"
        else:
            status = "OK"

        distribution.append(
            {
                "ad_id": ad_id,
                "objective": info["objective"],
                "ctr_baseline": round(ctr_baseline, 3),
                "ctr_recent": round(ctr_recent, 3),
                "decline_pct": round(decline, 1),
                "status": status,
            }
        )

        if status == "OK":
            continue

        row = {
            **{k: info[k] for k in (
                "brand", "campaign_id", "campaign_name", "ad_id", "ad_name",
            )},
            "objective": info["objective"],
            "objective_label": objective_label(info["objective"]),
            "period": f"{days[0]} to {days[-1]}",
            "recent_days": recent_days,
            "baseline_days": len(baseline_days),
            "ctr_baseline": round(ctr_baseline, 3),
            "ctr_recent": round(ctr_recent, 3),
            "decline_pct": round(decline, 1),
            "p_value": p,
            "significant": significant,
            "impressions_recent": rec["impressions"],
            "impressions_baseline": base["impressions"],
            "spend_recent": round(rec["spend"], 2),
            "frequency_daily_recent": None,
            "frequency_change_pct": None,
            "saturating": False,
            "message": (
                f"Creative Fatigue {status}: Ad set {ad_id} under Campaign "
                f"{info['campaign_id']} has fallen from {ctr_baseline:.2f}% to "
                f"{ctr_recent:.2f}% CTR ({decline:.0f}% down) over the last "
                f"{recent_days} days, on {rec['spend']:.0f} spend."
            ),
        }

        if status == "FATIGUED":
            spend_at_risk += rec["spend"]
            findings.append(row)
        else:
            watchlist.append(row)

    findings.sort(key=lambda f: -f["decline_pct"])
    watchlist.sort(key=lambda f: -f["decline_pct"])

    return {
        "mode": "fatigue",
        "table": TABLE,
        "brand": brand,
        "brand_label": "All brands" if brand == "all" else brand,
        "brand_source": "brand column",
        "platform": platform,
        "platform_label": "All platforms" if platform == "all" else platform,
        "platform_available": True,
        "entity_label": ENTITY_LABEL,
        "latest_period": days[-1],
        "window_start": days[0],
        "days_in_window": len(days),
        "recent_days": recent_days,
        "baseline_days": len(baseline_days),
        "min_decline_pct": min_decline_pct,
        "max_p_value": max_p_value,
        "min_impressions_each": min_impressions_each,
        "ads_evaluated": len(distribution),
        "ads_alerting": len(findings),
        "ads_watch": len(watchlist),
        "ads_skipped_low_volume": skipped,
        "spend_at_risk": round(spend_at_risk, 2),
        "steepest_decline_pct": max((f["decline_pct"] for f in findings), default=0),
        "ctr_mismatches": 0,
        "frequency_available": False,
        "findings": findings,
        "watchlist": watchlist,
        "distribution": distribution,
    }


def default_thresholds() -> dict[str, float]:
    return {key: metric.default_threshold for key, metric in METRICS.items()}
