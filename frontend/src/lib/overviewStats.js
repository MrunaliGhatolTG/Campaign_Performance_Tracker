/* Everything the overview charts plot, derived from the two alert responses.
   No new endpoints, no invented numbers: where a chart can only see flagged
   rows (the API returns detail for those only), the chart says so. */

import { brandLabel, objectiveLabel } from "./format.js";
import { OBJECTIVE_GROUPS, groupFor, reading } from "./metrics.js";

const shorten = (name, max = 18) =>
  !name ? "—" : name.length <= max ? name : `${name.slice(0, max - 1)}…`;

/** Brands when looking at all of them, campaigns when inside one brand. */
export function grouper(data) {
  if (data?.brand === "all") {
    return { label: "brand", of: (row) => brandLabel(row.brand) };
  }
  return {
    label: "campaign",
    of: (row) => shorten(String(row.campaign_name || "").replace(/^[^_]+_/, "")),
  };
}

/** CTR of every evaluated row, bucketed — the shape of the portfolio. */
/** Baseline against recent CTR: anything under the diagonal has slipped. */
export function movePoints(distribution = []) {
  const points = distribution
    .filter((d) => d.ctr_baseline != null && d.ctr_recent != null)
    .map((d) => ({
      x: d.ctr_baseline,
      y: d.ctr_recent,
      status: d.status,
      id: d.ad_id,
      decline: d.decline_pct,
    }));

  const domain = points.length
    ? Math.max(0.5, Math.max(...points.map((p) => Math.max(p.x, p.y))) * 1.1)
    : 1;

  return { points, domain };
}

/** Which objectives appear in the flagged rows, in their canonical order. */
export function objectivesIn(ctr) {
  const seen = new Set((ctr?.findings || []).map((f) => groupFor(f.objective || f.objective_label).key));
  return OBJECTIVE_GROUPS.filter((g) => seen.has(g.key));
}

const objectiveKey = (row) => groupFor(row.objective || row.objective_label).key;

/** The same cut, in money. */
export function spendByGroupAndObjective(ctr, keyOf) {
  const acc = {};
  for (const f of ctr?.findings || []) {
    const key = keyOf(f);
    acc[key] = acc[key] || { key };
    const o = objectiveKey(f);
    acc[key][o] = (acc[key][o] || 0) + (Number(f.spend) || 0);
  }

  return Object.values(acc)
    .map((r) => ({ ...r, total: OBJECTIVE_GROUPS.reduce((a, g) => a + (r[g.key] || 0), 0) }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);
}

/**
 * Brand down, objective across. Counts come from findings, which is the only
 * place the API puts a brand — distribution rows carry no brand, so this is
 * flagged rows, not a share of everything evaluated.
 */
export function brandObjectiveMatrix(ctr, keyOf) {
  const columns = objectivesIn(ctr);
  const acc = {};

  for (const f of ctr?.findings || []) {
    const key = keyOf(f);
    acc[key] = acc[key] || { key, cells: {}, total: 0, spend: 0 };
    const o = objectiveKey(f);
    acc[key].cells[o] = (acc[key].cells[o] || 0) + 1;
    acc[key].total += 1;
    acc[key].spend += Number(f.spend) || 0;
  }

  const rows = Object.values(acc).sort((a, b) => b.total - a.total);
  const totals = Object.fromEntries(
    columns.map((c) => [c.key, rows.reduce((a, r) => a + (r.cells[c.key] || 0), 0)]),
  );

  return { columns, rows, totals, grand: rows.reduce((a, r) => a + r.total, 0) };
}
