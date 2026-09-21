import { pct } from "../../lib/format.js";

const PAD = { t: 16, r: 18, b: 42, l: 62 };
const FILL = {
  FATIGUED: "var(--alert)",
  WATCH: "var(--warn)",
  SCALE: "var(--good)",
  RISING: "var(--good)",
};

/** Baseline CTR against recent CTR. Below the diagonal means it has slipped. */
export default function Scatter({ points, domain, width = 520, height = 300 }) {
  if (!points.length) return null;

  const w = width - PAD.l - PAD.r;
  const h = height - PAD.t - PAD.b;
  const x = (v) => PAD.l + (v / domain) * w;
  const y = (v) => PAD.t + h - (v / domain) * h;
  const ticks = [0, domain / 2, domain];

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img">
      {ticks.map((t, i) => (
        <g key={i}>
          <line className="c-grid" x1={PAD.l} x2={PAD.l + w} y1={y(t)} y2={y(t)} />
          <text className="c-tick" x={PAD.l - 9} y={y(t) + 4} textAnchor="end">
            {pct(t, 1)}
          </text>
          <text className="c-tick" x={x(t)} y={PAD.t + h + 18} textAnchor="middle">
            {pct(t, 1)}
          </text>
        </g>
      ))}

      <line
        x1={x(0)}
        y1={y(0)}
        x2={x(domain)}
        y2={y(domain)}
        style={{ stroke: "var(--rule-strong)", strokeWidth: 1.5, strokeDasharray: "5 4" }}
      />
      <text className="c-tick" x={x(domain) - 6} y={y(domain) + 16} textAnchor="end">
        no change
      </text>

      {points.map((p, i) => (
        <circle
          key={`${p.id}-${i}`}
          cx={x(p.x)}
          cy={y(p.y)}
          r={p.status === "FATIGUED" || p.status === "WATCH" ? 5.5 : 4}
          style={{
            fill: FILL[p.status] || "var(--neutral)",
            fillOpacity: p.status ? 0.85 : 0.5,
            stroke: "var(--surface)",
            strokeWidth: 1,
          }}
        >
          <title>{`${p.id}: ${pct(p.x)} to ${pct(p.y)}`}</title>
        </circle>
      ))}

      <line className="c-axis" x1={PAD.l} x2={PAD.l + w} y1={PAD.t + h} y2={PAD.t + h} />
      <text className="c-tick" x={PAD.l + w / 2} y={height - 6} textAnchor="middle">
        Baseline CTR
      </text>
      <text
        className="c-tick"
        transform={`rotate(-90 16 ${PAD.t + h / 2})`}
        x={16}
        y={PAD.t + h / 2}
        textAnchor="middle"
      >
        Recent CTR
      </text>
    </svg>
  );
}
