import { Fragment } from "react";
import { brandLabel, noun, num, objectiveLabel } from "../lib/format.js";
import { reading } from "../lib/metrics.js";

export default function BenchmarkTable({ data, thresholds }) {
  const rows = data.findings || [];
  const showBrand = data.brand === "all";
  // Inside one objective these two never vary, so they move to the header.
  const mixed = new Set(rows.map((f) => reading(f, thresholds).key)).size > 1;
  const cols = (showBrand ? 6 : 5) + (mixed ? 2 : 0);
  const n = noun(data);

  if (!rows.length) {
    return (
      <div className="panel">
        <div className="empty">
          <strong>Everything is at or above its benchmark</strong>
          {data.ads_evaluated} {n.lowerMany} were checked on {data.period}.
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <header>
        <h2>{n.many} below benchmark</h2>
        <span className="note">
          {mixed
            ? "Furthest below first"
            : `Judged on ${reading(rows[0], thresholds).label.toLowerCase()}, furthest below first`}
        </span>
      </header>

      <table>
        <thead>
          <tr>
            {showBrand ? <th>Brand</th> : null}
            <th>Campaign</th>
            <th>{n.one}</th>
            {mixed ? <th>Objective</th> : null}
            {mixed ? <th>Judged on</th> : null}
            <th className="r">Reading</th>
            <th className="r">Benchmark</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f, i) => {
            const r = reading(f, thresholds);
            return (
              <Fragment key={`${f.ad_id}-${i}`}>
                <tr className="head">
                  {showBrand ? <td>{brandLabel(f.brand)}</td> : null}
                  <td>
                    <div>{f.campaign_name}</div>
                    <div className="dim mono">{f.campaign_id}</div>
                  </td>
                  <td>
                    <div>{f.ad_name}</div>
                    <div className="dim mono">{f.ad_id}</div>
                    <div className="dim">
                      {num(f.impressions)} impressions, {num(f.clicks)} clicks
                    </div>
                  </td>
                  {mixed ? (
                    <td>{objectiveLabel(f.objective_label || f.objective) || "—"}</td>
                  ) : null}
                  {mixed ? <td>{r.label}</td> : null}
                  <td className="r">
                    <span className="strong" style={{ color: "var(--alert)" }}>
                      {r.text}
                    </span>
                    {r.ratio !== null ? (
                      <div className="dim">{Math.round(r.ratio)}% of benchmark</div>
                    ) : null}
                  </td>
                  <td className="r">{r.thresholdText}</td>
                  <td>
                    <span className="pill alert">
                      <i />
                      Alert
                    </span>
                  </td>
                </tr>
                <tr className="msg alert">
                  <td colSpan={cols}>
                    <div className="msgbox">{f.message}</div>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
