"""The morning brief, rendered as the plain HTML an email client would get."""

from __future__ import annotations

from html import escape

from . import alerts
from .benchmarks import METRICS, objective_label


def render(result: dict, schedule: dict) -> str:
    findings = result["findings"]
    rows = "".join(
        f"""
        <tr>
          <td>{escape(f['brand'])}</td>
          <td>{escape(f['ad_name'])}<div class="dim">{escape(f['campaign_name'])}</div></td>
          <td>{escape(objective_label(f['objective']) or '')}</td>
          <td class="r">{escape(METRICS[f['metric']].label)}</td>
          <td class="r"><b>{f['value']:,}</b></td>
          <td class="r">{f['threshold']:,}</td>
        </tr>"""
        for f in findings[:20]
    )

    headline = (
        f"{len(findings)} ad sets below benchmark"
        if findings
        else "Nothing below benchmark today"
    )

    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Morning brief</title>
<style>
  body {{ font-family: Calibri, system-ui, sans-serif; color: #10202F; background: #EFECED;
         margin: 0; padding: 32px; }}
  .sheet {{ max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #E4DEDF;
            border-radius: 10px; padding: 28px 32px; }}
  h1 {{ font-family: Cambria, Georgia, serif; font-size: 25px; margin: 0 0 4px; }}
  .lede {{ color: #64778A; margin: 0 0 22px; font-size: 14px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 14px; }}
  th {{ text-align: left; font-size: 12px; color: #64778A; padding: 10px 8px;
        border-bottom: 1px solid #E4DEDF; }}
  td {{ padding: 11px 8px; border-bottom: 1px solid #EFEAEB; vertical-align: top; }}
  th.r, td.r {{ text-align: right; }}
  .dim {{ color: #64778A; font-size: 12px; }}
  .foot {{ margin-top: 22px; color: #64778A; font-size: 12px; }}
</style></head>
<body><div class="sheet">
  <h1>{escape(headline)}</h1>
  <p class="lede">{escape(result['brand_label'])} &middot; {escape(result['period'])} &middot;
     each ad set judged on the metric its objective was bought for.</p>
  <table>
    <thead><tr>
      <th>Brand</th><th>Ad set</th><th>Objective</th>
      <th class="r">Judged on</th><th class="r">Reading</th><th class="r">Benchmark</th>
    </tr></thead>
    <tbody>{rows or '<tr><td colspan="6">Everything is at or above its benchmark.</td></tr>'}</tbody>
  </table>
  <p class="foot">Scheduled for {escape(schedule['time'])} {escape(schedule['timezone'])},
     {escape(', '.join(schedule['days']))}. Sample data.</p>
</div></body></html>"""


def subject(result: dict) -> str:
    """The Subject: line, carrying the count so the inbox alone is useful."""
    findings = result["findings"]
    head = (
        f"{len(findings)} ad set{'' if len(findings) == 1 else 's'} below benchmark"
        if findings
        else "Nothing below benchmark"
    )
    # Kept to ASCII on purpose: a non-ASCII Subject is RFC 2047 encoded and
    # folded, and clients then show the join as a doubled space.
    return f"Morning brief: {head} - {result['brand_label']} - {result['period']}"


def render_text(result: dict, schedule: dict) -> str:
    """The same brief as plain text, for clients that will not show HTML."""
    findings = result["findings"]

    lines = [
        subject(result),
        "",
        "Each ad set is judged on the metric its objective was bought for.",
        "",
    ]

    for f in findings[:20]:
        reading = f"{METRICS[f['metric']].label} {f['value']:,} against {f['threshold']:,}"
        lines.append(f"* {f['brand']} - {f['ad_name']}")
        lines.append(f"    {f['campaign_name']}")
        lines.append(f"    {objective_label(f['objective']) or ''} - {reading}")
        lines.append("")

    if not findings:
        lines += ["Everything is at or above its benchmark.", ""]
    elif len(findings) > 20:
        lines += [f"...and {len(findings) - 20} more.", ""]

    lines.append(
        f"Scheduled for {schedule['time']} {schedule['timezone']}, "
        f"{', '.join(schedule['days'])}."
    )
    return "\n".join(lines)


def build_brief(schedule: dict) -> tuple[str, str, str]:
    """One schedule's brief as (subject, html, text).

    Behind both /api/digest/preview and the scheduled send, so what is
    previewed is exactly what goes out.
    """
    result = alerts.low_ctr(
        brand=schedule.get("brand", "all"),
        platform="all",
        thresholds=alerts.default_thresholds(),
    )
    return subject(result), render(result, schedule), render_text(result, schedule)
