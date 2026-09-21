import { noun, periodLabel } from "../lib/format.js";

/** The spec bar under the masthead: what this reading actually covers. */
export default function Chips({ result }) {
  if (!result) return null;

  const n = noun(result);
  const platformKnown = result.platform_available !== false || result.platform !== "all";

  const cells = [
    { k: "Brand", v: result.brand_label },
    platformKnown
      ? { k: "Platform", v: result.platform_label || "All platforms" }
      : { k: "Placements", v: "All", muted: true },
    { k: "Grain", v: n.one, muted: true },
    { k: result.period ? "Reporting day" : "Window", v: periodLabel(result), muted: true },
  ];

  return (
    <div className="chips">
      {cells.map((c) => (
        <span key={c.k} className={`chip ${c.muted ? "muted" : ""}`}>
          <span className="k">{c.k}</span>
          <b>{c.v}</b>
        </span>
      ))}
    </div>
  );
}
