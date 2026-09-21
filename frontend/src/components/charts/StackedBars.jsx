/**
 * One bar per row, segments stacked in series order. Vertical for a handful of
 * categories, horizontal when the labels need the room.
 */
export default function StackedBars({
  rows,
  series,
  orientation = "vertical",
  format = (v) => v,
  width,
  height,
}) {
  if (!rows.length) return null;

  const top = Math.max(1, ...rows.map((r) => series.reduce((a, s) => a + (r[s.key] || 0), 0)));
  return orientation === "vertical" ? (
    <Vertical rows={rows} series={series} top={top} format={format} width={width} height={height} />
  ) : (
    <Horizontal rows={rows} series={series} top={top} format={format} width={width} height={height} />
  );
}

function Vertical({ rows, series, top, format, width = 520, height = 270 }) {
  const PAD = { t: 22, r: 14, b: 40, l: 34 };
  const w = width - PAD.l - PAD.r;
  const h = height - PAD.t - PAD.b;
  const step = w / rows.length;
  const band = Math.min(56, step - 16);
  // Category names have to fit their slot; the full name stays in the tooltip.
  const maxChars = Math.max(6, Math.floor(step / 6.6));

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img">
      <line className="c-axis" x1={PAD.l} x2={PAD.l + w} y1={PAD.t + h} y2={PAD.t + h} />

      {rows.map((r, i) => {
        const cx = PAD.l + i * step + step / 2;
        let cursor = PAD.t + h;
        const total = series.reduce((a, s) => a + (r[s.key] || 0), 0);

        return (
          <g key={r.key}>
            {series.map((s) => {
              const v = r[s.key] || 0;
              if (!v) return null;
              const barH = (v / top) * h;
              cursor -= barH;
              return (
                <rect
                  key={s.key}
                  x={cx - band / 2}
                  y={cursor}
                  width={band}
                  height={barH}
                  style={{ fill: s.color }}
                >
                  <title>{`${r.key} — ${s.label}: ${format(v)}`}</title>
                </rect>
              );
            })}
            <text className="c-val" x={cx} y={cursor - 8} textAnchor="middle">
              {format(total)}
            </text>
            <text className="c-tick" x={cx} y={PAD.t + h + 18} textAnchor="middle">
              {r.key.length > maxChars ? `${r.key.slice(0, maxChars - 1)}…` : r.key}
              <title>{r.key}</title>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Horizontal({ rows, series, top, format, width = 520, height }) {
  const PAD = { t: 8, r: 58, b: 8, l: 122 };
  const rowH = 30;
  const h = height || PAD.t + PAD.b + rows.length * rowH;
  const w = width - PAD.l - PAD.r;

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${h}`} role="img">
      {rows.map((r, i) => {
        const y = PAD.t + i * rowH;
        const total = series.reduce((a, s) => a + (r[s.key] || 0), 0);
        let cursor = PAD.l;

        return (
          <g key={r.key}>
            <text className="c-tick" x={PAD.l - 12} y={y + rowH / 2 + 4} textAnchor="end">
              {r.key}
            </text>
            {series.map((s) => {
              const v = r[s.key] || 0;
              if (!v) return null;
              const barW = (v / top) * w;
              const x = cursor;
              cursor += barW;
              return (
                <rect
                  key={s.key}
                  x={x}
                  y={y + 7}
                  width={Math.max(2, barW)}
                  height={rowH - 16}
                  style={{ fill: s.color }}
                >
                  <title>{`${r.key} — ${s.label}: ${format(v)}`}</title>
                </rect>
              );
            })}
            <text className="c-val" x={cursor + 9} y={y + rowH / 2 + 4}>
              {format(total)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
