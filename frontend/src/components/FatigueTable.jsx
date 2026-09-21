import { Fragment } from "react";
import { brandLabel, noun, num, pct, signed } from "../lib/format.js";

const TONE = { FATIGUED: "alert", WATCH: "watch" };
const STATUS = { FATIGUED: "Fatigued", WATCH: "Watch" };

export default function FatigueTable({ data }) {
  const rows = [...(data.findings || []), ...(data.watchlist || [])];
  const showBrand = data.brand === "all";
  const cols = showBrand ? 8 : 7;
  const n = noun(data);

  if (!rows.length) {
    return (
      <div className="panel">
        <div className="empty">
          <strong>Nothing has faded over this window</strong>
          {data.ads_evaluated} {n.lowerMany} were compared against their own baseline.
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <header>
        <h2>{n.many} losing their audience</h2>
        <span className="note">Steepest decline first, watchlist last</span>
      </header>

      <table>
        <thead>
          <tr>
            {showBrand ? <th>Brand</th> : null}
            <th>Campaign</th>
            <th>{n.one}</th>
            <th className="r">Baseline CTR</th>
            <th className="r">Recent CTR</th>
            <th className="r">Change</th>
            <th className="r">Frequency</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f, i) => {
            const tone = TONE[f.status] || "ok";
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
                      {num(f.spend_recent)} spent in the last {f.recent_days} days
                    </div>
                  </td>
                  <td className="r">
                    {pct(f.ctr_baseline)}
                    <div className="dim">{f.baseline_days} days</div>
                  </td>
                  <td className="r">
                    <span
                      className="strong"
                      style={{ color: tone === "alert" ? "var(--alert)" : "var(--warn-ink)" }}
                    >
                      {pct(f.ctr_recent)}
                    </span>
                    <div className="dim">{f.recent_days} days</div>
                  </td>
                  <td className="r">
                    {signed(-f.decline_pct)}
                    <div className="dim">p {f.p_value < 0.001 ? "< 0.001" : f.p_value}</div>
                  </td>
                  <td className="r">
                    {f.frequency_daily_recent != null ? (
                      <>
                        {Number(f.frequency_daily_recent).toFixed(2)}
                        <div className="dim">
                          {f.saturating ? "saturating" : signed(f.frequency_change_pct, 0)}
                        </div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <span className={`pill ${tone}`}>
                      <i />
                      {STATUS[f.status] || f.status}
                    </span>
                  </td>
                </tr>
                <tr className={`msg ${tone}`}>
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
