import { noun, num } from "../lib/format.js";
import {
  brandObjectiveMatrix,
  grouper,
  movePoints,
  objectivesIn,
  spendByGroupAndObjective,
} from "../lib/overviewStats.js";
import { useWidth } from "../hooks/useWidth.js";
import Legend from "../components/charts/Legend.jsx";
import Scatter from "../components/charts/Scatter.jsx";
import StackedBars from "../components/charts/StackedBars.jsx";

function Chart({ title, note, legend, children, empty }) {
  const [ref, width] = useWidth();
  const drawn = typeof children === "function" ? children(width) : children;

  return (
    <div className="panel">
      <header>
        <h2>{title}</h2>
        {legend || (note ? <span className="note">{note}</span> : null)}
      </header>
      <div className="body" ref={ref}>
        {drawn || <p className="chart-empty">{empty}</p>}
        {legend && note ? <p className="chart-note">{note}</p> : null}
      </div>
    </div>
  );
}

/** Brand down, objective across: where the flags are actually landing. */
function Matrix({ matrix, groupLabel, noun }) {
  const { columns, rows, totals, grand } = matrix;

  if (!rows.length || !columns.length) {
    return (
      <div className="panel">
        <header>
          <h2>Flags by {groupLabel} and objective</h2>
        </header>
        <div className="body">
          <p className="chart-empty">Nothing flagged for this selection.</p>
        </div>
      </div>
    );
  }

  const peak = Math.max(...rows.flatMap((r) => columns.map((c) => r.cells[c.key] || 0)), 1);

  return (
    <div className="panel">
      <header>
        <h2>Which {groupLabel}, which objective</h2>
        <span className="note">Flagged {noun.lowerMany} only</span>
      </header>
      <div className="body">
        <table className="matrix">
          <thead>
            <tr>
              <th>{groupLabel === "brand" ? "Brand" : "Campaign"}</th>
              {columns.map((c) => (
                <th key={c.key} className="r">
                  {c.label}
                </th>
              ))}
              <th className="r">All</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.key}</td>
                {columns.map((c) => {
                  const v = r.cells[c.key] || 0;
                  return (
                    <td key={c.key} className="r cell">
                      {v ? (
                        <span
                          className="tile"
                          style={{ background: c.color, opacity: 0.16 + (v / peak) * 0.38 }}
                        />
                      ) : null}
                      <span className="v">{v || "—"}</span>
                    </td>
                  );
                })}
                <td className="r total">{r.total}</td>
              </tr>
            ))}
            <tr className="foot">
              <td>All</td>
              {columns.map((c) => (
                <td key={c.key} className="r">
                  {totals[c.key] || "—"}
                </td>
              ))}
              <td className="r total">{grand}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Overview({ ctr, fatigue }) {
  const base = ctr || fatigue;
  const n = noun(base);
  const group = grouper(base);
  const hasFatigue = Boolean(fatigue);


  const { points, domain: moveDomain } = movePoints(fatigue?.distribution);
  // One series per objective, so every bar answers which brand and which
  // objective at the same time.
  const series = objectivesIn(ctr).map((o) => ({ key: o.key, label: o.label, color: o.color }));
  const spendRows = spendByGroupAndObjective(ctr, group.of);
  const matrix = brandObjectiveMatrix(ctr, group.of);

  return (
    <div className="results">
      <div className="grid-2">
      {hasFatigue ? (
        <Chart
          title="Has it faded?"
          note={`Each dot is one ${n.lower} over ${fatigue?.days_in_window || 14} days. Anything under the line is doing worse than its own baseline.`}
          legend={
            <Legend
              series={[
                { key: "f", label: "Fatigued", color: "var(--alert)" },
                { key: "w", label: "Watchlist", color: "var(--warn)" },
                { key: "o", label: "Holding up", color: "var(--neutral)" },
              ]}
            />
          }
          empty="Fatigue has not been run for this selection."
        >
          {(w) => (points.length ? <Scatter points={points} domain={moveDomain} width={w} /> : null)}
        </Chart>
        ) : null}

        <Chart
          title={`Spend behind the flags, by ${group.label} and objective`}
          note={`Spend on flagged ${n.lowerMany} for ${ctr?.period || "the latest day"} only.`}
          legend={<Legend series={series} />}
          empty="No spend attached to flagged rows."
        >
          {(w) =>
            spendRows.length ? (
              <StackedBars
                rows={spendRows}
                series={series}
                orientation="horizontal"
                format={(v) => num(v)}
                width={w}
              />
            ) : null
          }
        </Chart>

      </div>

      <Matrix matrix={matrix} groupLabel={group.label} noun={n} />
    </div>
  );
}
