import { noun } from "../lib/format.js";
import { reading } from "../lib/metrics.js";

const CAP = 300; // a row at 8x its benchmark shouldn't squash everything else

/**
 * Within one objective every row shares a metric, so the axis is that metric's
 * own — reach in people, CTR in percent. Across mixed objectives there is no
 * shared axis, so rows are drawn as a share of their own benchmark instead.
 */
export default function BenchmarkLadder({ data, thresholds }) {
  const rows = (data.distribution || [])
    .map((row) => ({ row, r: reading(row, thresholds) }))
    .filter(({ r }) => r.ratio !== null);

  if (!rows.length) return null;

  const metrics = [...new Set(rows.map(({ r }) => r.key))];
  const single = metrics.length === 1 ? rows[0].r.metric : null;
  const line = single ? rows[0].r.threshold : 100;

  const domain = single
    ? Math.max(line * 1.15, ...rows.map(({ r }) => r.value)) * 1.06
    : Math.min(CAP, Math.max(120, ...rows.map(({ r }) => r.ratio)) * 1.08);

  const marks = [0, domain / 2, domain];
  const at = (v) => `${Math.min(100, (v / domain) * 100)}%`;
  const axisText = (v) => (single ? single.format(v) : `${Math.round(v)}%`);

  return (
    <div className="panel">
      <header>
        <h2>
          Every {noun(data).lower} against {single ? `its ${single.label.toLowerCase()} benchmark` : "its own benchmark"}
        </h2>
        <span className="chart-legend">
          <span className="swatch">
            <i style={{ background: "var(--plot)" }} />
            At or above
          </span>
          <span className="swatch">
            <i style={{ background: "var(--alert)" }} />
            Below
          </span>
          <span className="swatch">
            <i className="dash" />
            {single ? single.format(line) : "Benchmark, 100%"}
          </span>
        </span>
      </header>

      <div className="body">
        <div style={{ maxHeight: 430, overflowY: "auto" }}>
          {rows.map(({ row, r }, i) => (
            <div className={`ladder-row ${r.below ? "alert" : ""}`} key={`${row.ad_id}-${i}`}>
              <span className="who mono" title={`${row.ad_id} — judged on ${r.label}`}>
                {row.ad_id}
              </span>
              <span className="track">
                <span className="bar" style={{ width: at(single ? r.value : r.ratio) }} />
                <span className="threshold-line" style={{ left: at(line) }} />
              </span>
              <span className="num" title={`${Math.round(r.ratio)}% of benchmark`}>
                {r.text}
                {r.below ? <span className="tag">below</span> : null}
              </span>
            </div>
          ))}
        </div>

        <div className="axis">
          <span />
          <span className="scale">
            {marks.map((m, i) => (
              <span
                className={`mark ${i === marks.length - 1 ? "end" : ""}`}
                key={i}
                style={{ left: at(m) }}
              >
                {axisText(m)}
              </span>
            ))}
          </span>
          <span />
        </div>
        <p className="chart-note">
          {single
            ? `Every ${noun(data).lower} bought for ${data.group?.label?.toLowerCase() || "this objective"}, judged on ${single.label.toLowerCase()}.`
            : "Share of each row's own benchmark: reach for awareness and reach buys, engagement rate for engagement, CTR for traffic and clicks."}
        </p>
      </div>
    </div>
  );
}
