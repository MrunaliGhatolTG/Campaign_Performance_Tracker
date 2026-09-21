import { metricFor } from "../lib/metrics.js";
/* PREVIEW ONLY.
   Answers the /api calls with invented numbers so the dashboard opens on any
   machine with no Fabric, no uvicorn and no sign-in. Loaded from main.jsx only
   when VITE_PREVIEW=1, so it never reaches the production bundle. The numbers
   are not real; the platform filter here is illustrative and does not reshape
   them. The emailed morning brief is a server feature, so its link is inert. */

const PLATFORM_LABEL = {
  all: "All platforms",
  facebook: "Facebook",
  instagram: "Instagram",
};

// Honours AbortSignal so the app's request cancellation behaves as it will
// against the real backend.
const wait = (body, ms, signal) =>
  new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort, { once: true });

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }, ms);
  });

let schedule = {
  enabled: true,
  time: "07:30",
  timezone: "Africa/Lagos",
  days: ["mon", "tue", "wed", "thu", "fri"],
  recipients: ["campaign.team@example.com"],
  brand: "all",
  alerts: ["low-ctr"],
};

/* PREVIEW ONLY. The fixture predates per-objective benchmarks: every row in it
   was judged on CTR. To show the mapping working, each flagged row is given an
   objective in turn and a reading for the metric that objective is bought on.
   Those reach and engagement numbers are invented, like the rest of the file. */
const OBJECTIVES = [
  "OUTCOME_TRAFFIC",
  "OUTCOME_AWARENESS",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_REACH",
];


/* More of the portfolio, so the by-brand charts show a realistic spread.
   Invented, like everything else in this file. */
const EXTRA_BRANDS = [
  ["Lush", "Lush_Awareness_Nationwide", "Reels 15s | Fresh laundry", "OUTCOME_AWARENESS", 212.4, 41200, 96],
  ["Colgate", "Colgate_Traffic_Lagos", "Static | Smile promo", "OUTCOME_TRAFFIC", 168.9, 28400, 210],
  ["Power Oil", "PowerOil_Engagement_SouthWest", "Story | Recipe tips", "OUTCOME_ENGAGEMENT", 96.2, 15800, 141],
  ["Hypo", "Hypo_Reach_Nationwide", "Static | Clean home", "OUTCOME_REACH", 143.7, 33600, 88],
  ["Minimie", "Minimie_Traffic_Abuja", "Reels 10s | Chin chin", "OUTCOME_TRAFFIC", 74.5, 12900, 108],
  ["Munch It", "MunchIt_Awareness_Lagos", "Static | Snack break", "OUTCOME_AWARENESS", 51.3, 9400, 47],
  ["Addme", "Addme_Engagement_Nationwide", "Reels 20s | Top up", "OUTCOME_ENGAGEMENT", 118.6, 21700, 174],
];

function extraFindings(thresholds) {
  return EXTRA_BRANDS.map(([brand, campaign, ad, objective, spend, impressions, clicks], i) => {
    const metric = metricFor(objective);
    const threshold = thresholds[metric];
    const factor = 0.32 + ((i * 7) % 5) * 0.11; // 0.32 to 0.76 of the benchmark
    const value =
      metric === "reach"
        ? Math.round(threshold * factor)
        : Number((threshold * factor).toFixed(2));

    return {
      brand,
      campaign_id: `23859150${10 + i}`,
      campaign_name: campaign,
      ad_id: `12021748${200 + i}`,
      ad_name: ad,
      objective,
      objective_label: objective,
      period: "2026-08-30",
      metric,
      value,
      threshold,
      ctr: metric === "ctr" ? value : undefined,
      threshold_pct: thresholds.ctr,
      status: "ALERT",
      impressions,
      clicks,
      spend,
      message:
        `Below benchmark: Ad set 12021748${200 + i} under Campaign 23859150${10 + i} has a ` +
        `${metric === "reach" ? "reach" : metric === "ctr" ? "CTR" : "engagement rate"} of ` +
        `${value}${metric === "reach" ? "" : "%"}, below the ${threshold}` +
        `${metric === "reach" ? "" : "%"} benchmark for its objective.`,
    };
  });
}

function withBenchmarks(block, q) {
  const thresholds = {
    ctr: Number(q.get("threshold_ctr") ?? 1.5),
    engagement_rate: Number(q.get("threshold_engagement_rate") ?? 2),
    reach: Number(q.get("threshold_reach") ?? 10000),
  };

  const seed = (id) => (Number(String(id).slice(-3)) || 7) % 9;

  const byId = new Map();
  const findings = (block.findings || []).map((f, i) => {
    const objective = OBJECTIVES[i % OBJECTIVES.length];
    const metric = metricFor(objective);
    const threshold = thresholds[metric];
    const value =
      metric === "ctr"
        ? f.ctr
        : metric === "reach"
          ? Math.round(threshold * (0.3 + seed(f.ad_id) * 0.06))
          : Number((threshold * (0.3 + seed(f.ad_id) * 0.06)).toFixed(2));

    const row = {
      ...f,
      objective,
      objective_label: objective,
      metric,
      value,
      threshold,
      message:
        metric === "ctr"
          ? f.message
          : `Below benchmark: Ad set ${f.ad_id} under Campaign ${f.campaign_id} has a ` +
            `${metric === "reach" ? "reach" : "engagement rate"} of ${value}` +
            `${metric === "reach" ? "" : "%"}, below the ${threshold}` +
            `${metric === "reach" ? "" : "%"} benchmark for its objective.`,
    };
    byId.set(f.ad_id, row);
    return row;
  });

  const distribution = (block.distribution || []).map((d) => {
    const hit = byId.get(d.ad_id);
    return hit
      ? { ...d, objective: hit.objective, metric: hit.metric, value: hit.value, threshold: hit.threshold }
      : {
          ...d,
          objective: "OUTCOME_TRAFFIC",
          metric: "ctr",
          value: d.ctr,
          // keep the fixture's own line so the ladder and the table agree
          threshold: d.threshold ?? thresholds.ctr,
        };
  });

  const added = extraFindings(thresholds);
  const allFindings = [...findings, ...added];
  const allRows = [
    ...distribution,
    ...added.map((f) => ({
      ad_id: f.ad_id,
      objective: f.objective,
      metric: f.metric,
      value: f.value,
      threshold: f.threshold,
      ctr: f.ctr,
      status: "ALERT",
    })),
  ];

  return {
    ...block,
    threshold_mode: "by_objective",
    findings: allFindings,
    distribution: allRows,
    // keep the headline counts in step with the rows actually returned
    ads_alerting: allFindings.length,
    ads_evaluated: allRows.length,
    spend_on_alerting_ads: Math.round(
      allFindings.reduce((a, f) => a + (Number(f.spend) || 0), 0),
    ),
  };
}

/* The fixture's dates were baked in when it was generated. Shift every date in
   it by the gap between its newest day and yesterday, so the preview opens on a
   current window instead of a fixed one in the past. Every date moves by the
   same number of days, so window_start / latest_period distances survive. */
const FIXTURE_LATEST = "2026-08-30";
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function fixtureDayOffset() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const to = Date.UTC(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
  const from = Date.parse(`${FIXTURE_LATEST}T00:00:00Z`);
  return Math.round((to - from) / 86400000);
}

function shiftDates(value, days) {
  if (typeof value === "string") {
    if (!ISO_DAY.test(value)) return value;
    const d = new Date(`${value}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, days));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shiftDates(v, days)]));
  }
  return value;
}

export async function installMockApi() {
  const { default: RAW } = await import("./previewData.json");
  const PREVIEW = shiftDates(RAW, fixtureDayOffset());
  const passthrough = window.fetch.bind(window);

  window.fetch = function mockFetch(url, opts = {}) {
    const u = String(url);
    const signal = opts.signal;

    if (u.includes("/api/brands")) {
      const brands = [
        ...PREVIEW.brands.brands,
        ...EXTRA_BRANDS.map(([b]) => ({ key: b, label: b })),
      ];
      return wait({ ...PREVIEW.brands, brands }, 120, signal);
    }
    if (u.includes("/api/platforms")) return wait(PREVIEW.platforms, 120, signal);
    if (u.includes("/api/thresholds")) return wait(PREVIEW.thresholds, 90, signal);

    // Scheduled delivery: kept in memory for the session so the page behaves,
    // saved nowhere.
    if (u.includes("/api/digest/schedule")) {
      if ((opts.method || "GET").toUpperCase() === "PUT") {
        schedule = { ...schedule, ...JSON.parse(opts.body || "{}") };
        return wait(schedule, 260, signal);
      }
      return wait(schedule, 160, signal);
    }

    if (u.includes("/api/alerts/")) {
      const q = new URLSearchParams(u.split("?")[1] || "");
      const brand = q.get("brand") || "all";
      const plat = q.get("platform") || "all";

      let which = "creative-fatigue";
      if (u.includes("low-ctr")) {
        which = q.get("threshold_mode") === "flat" ? "low-ctr-flat" : "low-ctr";
      } else if (u.includes("winners")) {
        which = "winners";
      }

      const block = PREVIEW.data[brand] || PREVIEW.data.all;
      let base = block[which] || block["creative-fatigue"];
      if (which.startsWith("low-ctr")) {
        base = withBenchmarks(base, q);
        if (brand !== "all" && !PREVIEW.data[brand]) {
          const keep = new Set(
            base.findings.filter((f) => f.brand === brand).map((f) => f.ad_id),
          );
          const findings = base.findings.filter((f) => keep.has(f.ad_id));
          const distribution = base.distribution.filter((d) => keep.has(d.ad_id));
          base = {
            ...base,
            brand,
            brand_label: brand,
            findings,
            distribution,
            ads_alerting: findings.length,
            ads_evaluated: distribution.length,
          };
        }
      }

      return wait(
        {
          ...base,
          platform: plat,
          platform_label: PLATFORM_LABEL[plat] || plat,
          platform_available: true,
        },
        240,
        signal,
      );
    }

    return passthrough(url, opts);
  };
}
