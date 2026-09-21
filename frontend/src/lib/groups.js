import { OBJECTIVE_GROUPS, groupFor, reading } from "./metrics.js";

const objectiveOf = (row) => row.objective || row.objective_label;

/** The objective groups actually present in a response, with their counts. */
export function groupsIn(data) {
  if (!data) return [];

  const seen = new Map();
  const bump = (row, field) => {
    const g = groupFor(objectiveOf(row));
    const entry = seen.get(g.key) || { ...g, evaluated: 0, flagged: 0 };
    entry[field] += 1;
    seen.set(g.key, entry);
  };

  (data.distribution || []).forEach((r) => bump(r, "evaluated"));
  (data.findings || []).forEach((r) => bump(r, "flagged"));

  // A findings-only response still produces a group; evaluated falls back to
  // the flagged count so the tab never reads "of 0".
  return OBJECTIVE_GROUPS.map((g) => seen.get(g.key))
    .filter(Boolean)
    .map((g) => ({ ...g, evaluated: Math.max(g.evaluated, g.flagged) }));
}

/** One group's slice of a response, shaped like the response itself. */
export function sliceFor(data, group, thresholds) {
  const keep = (row) => groupFor(objectiveOf(row)).key === group.key;

  const findings = (data.findings || []).filter(keep);
  const distribution = (data.distribution || []).filter(keep);

  const spend = findings.reduce((a, f) => a + (Number(f.spend) || 0), 0);
  const worst = findings
    .map((f) => ({ f, r: reading(f, thresholds) }))
    .filter(({ r }) => r.ratio !== null)
    .sort((a, b) => a.r.ratio - b.r.ratio)[0];

  return {
    ...data,
    group,
    findings,
    distribution,
    ads_evaluated: Math.max(distribution.length, findings.length),
    ads_alerting: findings.length,
    spend_on_alerting_ads: spend,
    worst,
  };
}
