import { DEFAULT_THRESHOLDS, METRIC_LIST } from "./metrics.js";

/* One place that knows what an alert is. Adding "winners" later means adding a
   third entry here plus its page; nothing else has to learn about it. */

export const ALERTS = {
  ctr: {
    key: "ctr",
    label: "Below benchmark",
    path: "/api/alerts/low-ctr",
    title: "Below benchmark",
    lede:
      "Every ad set judged on the metric its objective was bought for: reach for " +
      "awareness and reach, engagement rate for engagement, CTR for traffic and clicks.",
    // Not exposed as a control: the CTR unit is read from the data.
    fixed: { ctr_scale: "auto" },
    defaults: { ...DEFAULT_THRESHOLDS },
    settings: METRIC_LIST.map((m) => ({
      id: `thr-${m.key}`,
      key: m.key,
      label: m.settingLabel,
      step: m.step,
      min: "0",
      hint: m.hint,
    })),
    // One threshold per metric, plus threshold_pct so an endpoint that only
    // knows about CTR keeps working.
    toParams: (s) => ({
      threshold_ctr: s.ctr,
      threshold_engagement_rate: s.engagement_rate,
      threshold_reach: s.reach,
      threshold_pct: s.ctr,
      threshold_mode: "by_objective",
    }),
  },

  fatigue: {
    key: "fatigue",
    label: "Creative fatigue",
    path: "/api/alerts/creative-fatigue",
    title: "Creative fatigue",
    lede:
      "Creatives that worked and have stopped working: a statistically real drop " +
      "in click-through rate over the last few days against their own baseline.",
    fixed: {},
    defaults: { min_decline_pct: 25 },
    settings: [
      {
        id: "decline",
        key: "min_decline_pct",
        label: "Flag a drop of at least",
        step: "5",
        min: "0",
        max: "100",
        hint: "Smaller, still-significant drops appear on the watchlist rather than as alerts.",
      },
    ],
  },
};

/* Which alerts the app actually shows. Creative fatigue is defined above and
   its page, chart and table are still in the tree — put ALERTS.fatigue back in
   this list to turn the tab, the overview scatter and its queries back on. */
export const ALERT_LIST = [ALERTS.ctr];

export const isEnabled = (key) => ALERT_LIST.some((a) => a.key === key);
