import { noun, num } from "../lib/format.js";
import BenchmarkLadder from "../components/BenchmarkLadder.jsx";
import BenchmarkTable from "../components/BenchmarkTable.jsx";
import Strip from "../components/Strip.jsx";
import { Notice } from "../components/States.jsx";

export default function BenchmarkPage({ data, thresholds }) {
  const n = noun(data);
  const group = data.group;

  const segments = [
    {
      key: "alert",
      label: "Below benchmark",
      color: "var(--alert)",
      count: data.ads_alerting || 0,
    },
    {
      key: "ok",
      label: "At or above",
      color: "var(--neutral)",
      count: Math.max(0, (data.ads_evaluated || 0) - (data.ads_alerting || 0)),
    },
  ];

  return (
    <div className="results">
      <Strip
        segments={segments}
        total={num(data.ads_evaluated)}
        ofLabel={`${group ? `${group.label.toLowerCase()} ` : ""}${n.lowerMany} on ${data.period}`}
      />

      {data.threshold_mode && data.threshold_mode !== "by_objective" ? (
        <Notice title="The server judged every row on CTR">
          It answered with <code>{data.threshold_mode}</code>, so rows bought for awareness,
          reach or engagement are still being measured on clicks. The objective each row was
          bought for is shown below, and the per-metric thresholds are being sent — the
          endpoint has to act on them.
        </Notice>
      ) : null}

      {data.ctr_mismatches > 0 ? (
        <Notice title="The stored CTR column disagrees with clicks ÷ impressions">
          {data.ctr_mismatches} of {data.ads_alerting} flagged {n.lowerMany} differ by more
          than 0.05 points. Unit read as <code>{data.ctr_unit_detected}</code>. Worth raising
          with whoever owns the gold layer.
        </Notice>
      ) : null}

      <BenchmarkLadder data={data} thresholds={thresholds} />
      <BenchmarkTable data={data} thresholds={thresholds} />
    </div>
  );
}
