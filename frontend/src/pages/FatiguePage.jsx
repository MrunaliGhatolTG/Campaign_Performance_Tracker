import { countOf, noun, num, pct } from "../lib/format.js";
import FatigueTable from "../components/FatigueTable.jsx";
import Kpi from "../components/Kpi.jsx";
import MoveChart from "../components/MoveChart.jsx";
import Strip from "../components/Strip.jsx";
import { Notice } from "../components/States.jsx";

export default function FatiguePage({ data }) {
  const n = noun(data);
  const flagged = data.ads_alerting || 0;
  const watch = data.ads_watch || 0;

  const segments = [
    { key: "alert", label: "Fatigued", color: "var(--alert)", count: flagged },
    { key: "watch", label: "Watchlist", color: "var(--warn)", count: watch },
    {
      key: "ok",
      label: "Holding up",
      color: "var(--neutral)",
      count: Math.max(0, (data.ads_evaluated || 0) - flagged - watch),
    },
  ];

  return (
    <div className="results">
      <div className="kpis">
        <Kpi
          label={`${n.many} fatigued`}
          value={num(flagged)}
          sub={`of ${num(data.ads_evaluated)} with enough volume to judge`}
          tone={flagged ? "flag" : ""}
        />
        <Kpi
          label="Steepest decline"
          value={pct(data.steepest_decline_pct, 1)}
          sub={data.findings?.[0]?.ad_name || "nothing flagged"}
          tone={flagged ? "flag" : ""}
        />
        <Kpi
          label="Spend at risk"
          value={num(data.spend_at_risk)}
          sub={`over the last ${data.recent_days} days`}
        />
        <Kpi
          label="On the watchlist"
          value={num(watch)}
          sub="real but shallower declines"
          tone={watch ? "warn" : ""}
        />
      </div>

      <Strip
        segments={segments}
        total={num(data.ads_evaluated)}
        ofLabel={`${n.lowerMany} over ${data.days_in_window} days`}
      />

      {data.ads_skipped_low_volume > 0 ? (
        <Notice title="Some rows were too quiet to judge">
          {countOf(data.ads_skipped_low_volume, data)} had fewer than{" "}
          {num(data.min_impressions_each)} impressions in one of the two periods, so a change
          in CTR would not mean anything. They are left out rather than guessed at.
        </Notice>
      ) : null}

      <MoveChart data={data} />
      <FatigueTable data={data} />
    </div>
  );
}
