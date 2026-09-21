/* What each objective is judged on.
     Awareness  -> Reach
     Reach      -> Reach
     Engagement -> Engagement rate
     Clicks     -> CTR
   One place: the table, the ladder, the charts and the thresholds all read
   from here, so adding a metric is an entry in METRICS plus a line in RULES. */

import { num, pct } from "./format.js";

export const METRICS = {
  reach: {
    key: "reach",
    label: "Reach",
    format: (v) => (v === null || v === undefined ? "—" : num(v)),
    defaultThreshold: 10000,
    step: "500",
    settingLabel: "Alert below this reach",
    hint: "People reached on the reporting day, for awareness and reach buys.",
  },
  engagement_rate: {
    key: "engagement_rate",
    label: "Engagement rate",
    format: (v) => pct(v),
    defaultThreshold: 2,
    step: "0.1",
    settingLabel: "Alert below this engagement rate",
    hint: "Engagements over impressions, for engagement buys.",
  },
  ctr: {
    key: "ctr",
    label: "CTR",
    format: (v) => pct(v),
    defaultThreshold: 1.5,
    step: "0.1",
    settingLabel: "Alert below this CTR",
    hint: "Clicks over impressions, for traffic and click buys.",
  },
};

export const METRIC_LIST = [METRICS.ctr, METRICS.engagement_rate, METRICS.reach];

// First match wins. Meta sends OUTCOME_*; older accounts send the bare name.
const RULES = [
  [/AWARENESS|BRAND_AWARENESS/i, "reach"],
  [/REACH/i, "reach"],
  [/ENGAGEMENT/i, "engagement_rate"],
  [/TRAFFIC|CLICK/i, "ctr"],
];

export function metricFor(objective) {
  const raw = String(objective || "");
  for (const [pattern, key] of RULES) if (pattern.test(raw)) return key;
  return "ctr";
}

export const DEFAULT_THRESHOLDS = {
  ctr: METRICS.ctr.defaultThreshold,
  engagement_rate: METRICS.engagement_rate.defaultThreshold,
  reach: METRICS.reach.defaultThreshold,
};

/**
 * What a row was judged on and how it did. Takes the server's own metric,
 * value and threshold when they are there; falls back to the objective map and
 * the CTR fields, so this still works against the endpoint as it is today.
 */
export function reading(row, thresholds = DEFAULT_THRESHOLDS) {
  const key = row.metric || metricFor(row.objective || row.objective_label);
  const metric = METRICS[key] || METRICS.ctr;

  const value = row.value ?? row[key] ?? (key === "ctr" ? row.ctr : undefined);
  const threshold =
    row.threshold ??
    (key === "ctr" ? row.threshold_pct : undefined) ??
    Number(thresholds?.[key] ?? metric.defaultThreshold);

  const has = value !== null && value !== undefined && !Number.isNaN(Number(value));
  const ratio = has && threshold ? (Number(value) / Number(threshold)) * 100 : null;

  return {
    key,
    metric,
    label: metric.label,
    value: has ? Number(value) : null,
    threshold: Number(threshold),
    ratio,
    text: has ? metric.format(Number(value)) : "—",
    thresholdText: metric.format(Number(threshold)),
    below: has ? Number(value) < Number(threshold) : false,
    missing: !has,
  };
}

/* Alerts are segregated by objective: each group holds only the rows bought
   for it and is judged on one metric, so a group's ladder can use that
   metric's own axis and its own threshold field. */
export const OBJECTIVE_GROUPS = [
  { key: "awareness", label: "Awareness", metric: "reach", color: "var(--alert)", match: /AWARENESS/i },
  { key: "reach", label: "Reach", metric: "reach", color: "var(--warn)", match: /REACH/i },
  {
    key: "engagement",
    label: "Engagement",
    metric: "engagement_rate",
    color: "var(--good)",
    match: /ENGAGEMENT/i,
  },
  { key: "clicks", label: "Clicks", metric: "ctr", color: "var(--plot)", match: /TRAFFIC|CLICK/i },
];

// Anything unrecognised, or a row with no objective at all, sits with clicks —
// the same fallback metricFor uses.
export const GROUP_FALLBACK = OBJECTIVE_GROUPS[3];

export function groupFor(objective) {
  const raw = String(objective || "");
  return OBJECTIVE_GROUPS.find((g) => g.match.test(raw)) || GROUP_FALLBACK;
}

export const groupByKey = (key) =>
  OBJECTIVE_GROUPS.find((g) => g.key === key) || GROUP_FALLBACK;
