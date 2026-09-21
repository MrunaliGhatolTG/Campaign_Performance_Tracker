"""What each objective is judged on, and how a row is scored against it.

    Awareness  -> reach
    Reach      -> reach
    Engagement -> engagement rate
    Clicks     -> CTR

This mirrors src/lib/metrics.js in the frontend. Keep the two in step: the API
is the authority, but the UI falls back to this same mapping when a response
omits the metric fields.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

METRIC_REACH = "reach"
METRIC_ENGAGEMENT = "engagement_rate"
METRIC_CTR = "ctr"


@dataclass(frozen=True)
class Metric:
    key: str
    label: str
    default_threshold: float
    decimals: int


METRICS: dict[str, Metric] = {
    METRIC_REACH: Metric(METRIC_REACH, "Reach", 10_000, 0),
    METRIC_ENGAGEMENT: Metric(METRIC_ENGAGEMENT, "Engagement rate", 2.0, 2),
    METRIC_CTR: Metric(METRIC_CTR, "CTR", 1.5, 2),
}

# First match wins. Meta sends OUTCOME_*; older accounts send the bare name.
_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"AWARENESS", re.I), METRIC_REACH),
    (re.compile(r"REACH", re.I), METRIC_REACH),
    (re.compile(r"ENGAGEMENT", re.I), METRIC_ENGAGEMENT),
    (re.compile(r"TRAFFIC|CLICK", re.I), METRIC_CTR),
]


def metric_for(objective: str | None) -> str:
    """The metric an objective is judged on; CTR for anything unrecognised."""
    raw = objective or ""
    for pattern, metric in _RULES:
        if pattern.search(raw):
            return metric
    return METRIC_CTR


def objective_label(objective: str | None) -> str | None:
    """OUTCOME_TRAFFIC -> Traffic."""
    if not objective:
        return None
    cleaned = re.sub(r"^OUTCOME[_-]", "", objective, flags=re.I)
    return cleaned.replace("_", " ").replace("-", " ").title()


def reading_of(row: dict, thresholds: dict[str, float]) -> dict:
    """What a row scored, against the benchmark for its own objective."""
    metric = metric_for(row.get("objective"))
    value = row[metric]
    threshold = float(thresholds[metric])

    return {
        "metric": metric,
        "metric_label": METRICS[metric].label,
        "value": round(value, METRICS[metric].decimals),
        "threshold": threshold,
        "below": value < threshold,
        "ratio_pct": round((value / threshold) * 100, 1) if threshold else None,
    }


def message_for(row: dict, reading: dict) -> str:
    """The sentence that appears under the row and in the morning brief."""
    metric = reading["metric"]
    unit = "" if metric == METRIC_REACH else "%"
    shown = f"{reading['value']:,.0f}" if metric == METRIC_REACH else f"{reading['value']:.2f}"
    limit = (
        f"{reading['threshold']:,.0f}" if metric == METRIC_REACH else f"{reading['threshold']:.2f}"
    )

    return (
        f"Below benchmark: Ad set {row['ad_id']} under Campaign {row['campaign_id']} "
        f"has {METRICS[metric].label.lower()} of {shown}{unit}, below the {limit}{unit} "
        f"benchmark for {objective_label(row['objective'])}."
    )
