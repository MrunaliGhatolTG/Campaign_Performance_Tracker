import { noun, pct } from "../lib/format.js";

const TONE = { FATIGUED: "alert", WATCH: "watch", SCALE: "up", RISING: "rise" };

/**
 * Every row's CTR as a move: hollow dot where it was over the baseline, solid
 * dot where it is now, the line between them carrying the size of the change.
 */
export default function MoveChart({ data }) {
  const rows = data.distribution || [];
  if (!rows.length) return null;

  const ceiling =
    Math.max(...rows.map((r) => Math.max(r.ctr_baseline || 0, r.ctr_recent || 0))) * 1.12 || 1;
  const marks = [0, ceiling / 2, ceiling];
  const at = (v) => `${Math.min(100, Math.max(0, (v / ceiling) * 100))}%`;

  return (
    <div className="panel">
      <header>
        <h2>How every {noun(data).lower} has moved</h2>
        <span className="chart-legend">
          <span className="swatch">
            <i className="hollow" />
            Baseline, {data.baseline_days} days
          </span>
          <span className="swatch">
            <i style={{ background: "var(--neutral)" }} />
            Last {data.recent_days} days
          </span>
        </span>
      </header>

      <div className="body">
        <div style={{ maxHeight: 430, overflowY: "auto" }}>
          {rows.map((r, i) => {
            const lo = Math.min(r.ctr_baseline, r.ctr_recent);
            const hi = Math.max(r.ctr_baseline, r.ctr_recent);
            const tone = TONE[r.status] || "ok";
            return (
              <div className={`move-row ${tone}`} key={`${r.ad_id}-${i}`}>
                <span className="who mono" title={r.ad_id}>
                  {r.ad_id}
                </span>
                <span className="track">
                  <span className="span" style={{ left: at(lo), width: at(hi - lo) }} />
                  <span className="was" style={{ left: at(r.ctr_baseline) }} />
                  <span className="now" style={{ left: at(r.ctr_recent) }} />
                </span>
                <span className="num">{pct(r.ctr_recent)}</span>
                <span className="delta">
                  <span className="arw">{r.decline_pct > 0 ? "↓" : "↑"}</span>
                  {pct(Math.abs(r.decline_pct), 1)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="move-axis">
          <span />
          <span className="scale">
            {marks.map((m, i) => (
              <span
                className={`mark ${i === marks.length - 1 ? "end" : ""}`}
                key={i}
                style={{ left: at(m) }}
              >
                {pct(m, 1)}
              </span>
            ))}
          </span>
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
