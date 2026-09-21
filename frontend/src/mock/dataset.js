/* The demo dataset: brands, campaigns, ad sets and a day-by-day row per
   platform, with the metrics Meta reports. Everything the app shows is derived
   from here, so the brand and platform filters do real work.

   Numbers are invented but deterministic — the same seed gives the same
   dataset every load, so figures don't jump around between reloads. */

const SEED = 20260830;
const DAYS = 14;

export const PLATFORMS = [
  { key: "facebook", label: "Facebook", share: 0.53 },
  { key: "instagram", label: "Instagram", share: 0.47 },
];

export const OBJECTIVES = {
  awareness: "OUTCOME_AWARENESS",
  reach: "OUTCOME_REACH",
  engagement: "OUTCOME_ENGAGEMENT",
  traffic: "OUTCOME_TRAFFIC",
};

const BRANDS = [
  { key: "Indomie", weight: 1.6 },
  { key: "Nutrify", weight: 1.1 },
  { key: "Lush", weight: 0.9 },
  { key: "Colgate", weight: 1.2 },
  { key: "Hypo", weight: 0.7 },
  { key: "Power Oil", weight: 0.8 },
  { key: "Minimie", weight: 0.6 },
  { key: "Munch It", weight: 0.5 },
  { key: "Addme", weight: 0.7 },
];

const REGIONS = ["Lagos", "Nationwide", "SouthWest", "SouthEast", "Abuja", "Kano"];

const CREATIVES = [
  "Reels 15s | Mum & child",
  "Reels 20s | Jollof recipe",
  "Static | Shelf takeover",
  "Story | Price drop",
  "Static | Market stall",
  "Reels 10s | Chin chin",
  "Static | Pack shot naira price",
  "Story | Recipe tips",
  "Reels 15s | Fresh laundry",
  "Static | Smile promo",
  "Story | Chef cameo",
  "Static | Family dinner",
];

// mulberry32: small, dependency-free, repeatable
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d) => d.toISOString().slice(0, 10);

function lastDays(n) {
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  end.setDate(end.getDate() - 1); // yesterday is the latest complete day
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (n - 1 - i));
    return iso(d);
  });
}

const OBJECTIVE_SHAPE = {
  [OBJECTIVES.awareness]: { ctr: 0.9, engagement: 1.4, frequency: 1.5, cpm: 3.1 },
  [OBJECTIVES.reach]: { ctr: 0.8, engagement: 1.2, frequency: 1.3, cpm: 2.6 },
  [OBJECTIVES.engagement]: { ctr: 1.4, engagement: 3.4, frequency: 1.8, cpm: 3.8 },
  [OBJECTIVES.traffic]: { ctr: 2.1, engagement: 1.9, frequency: 1.6, cpm: 4.4 },
};

const OBJECTIVE_CYCLE = [
  OBJECTIVES.traffic,
  OBJECTIVES.awareness,
  OBJECTIVES.engagement,
  OBJECTIVES.reach,
];

/** Builds the whole dataset once, at module load. */
function build() {
  const random = rng(SEED);
  const dates = lastDays(DAYS);
  const adSets = [];

  let campaignSeq = 2385914400;
  let adSeq = 120217481000;

  BRANDS.forEach((brand, bi) => {
    const campaignCount = 2 + (bi % 2); // two or three campaigns each

    for (let c = 0; c < campaignCount; c += 1) {
      const objective = OBJECTIVE_CYCLE[(bi + c) % OBJECTIVE_CYCLE.length];
      const region = REGIONS[(bi + c * 2) % REGIONS.length];
      const shortObjective = objective.replace("OUTCOME_", "");
      const campaign = {
        id: String((campaignSeq += 1)),
        name: `${brand.key.replace(/\s+/g, "")}_${
          shortObjective.charAt(0) + shortObjective.slice(1).toLowerCase()
        }_${region}`,
        objective,
      };

      const adSetCount = 2 + Math.floor(random() * 2); // two or three ad sets
      for (let a = 0; a < adSetCount; a += 1) {
        const shape = OBJECTIVE_SHAPE[objective];

        // A few ad sets are deliberately weak, and a few deliberately fade, so
        // both alerts have something real to find.
        const weak = random() < 0.28;
        const fading = !weak && random() < 0.22;

        const scale = brand.weight * (0.6 + random() * 0.9);
        const baseCtr = shape.ctr * (weak ? 0.3 + random() * 0.25 : 0.85 + random() * 0.7);
        const baseEngagement =
          shape.engagement * (weak ? 0.3 + random() * 0.25 : 0.85 + random() * 0.6);

        adSets.push({
          brand: brand.key,
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          objective,
          ad_id: String((adSeq += 7)),
          ad_name: CREATIVES[(bi * 3 + c * 2 + a) % CREATIVES.length],
          status: random() < 0.12 ? "PAUSED" : "ACTIVE",
          daily: dates.map((date, di) => {
            // the fade lands in the last three days
            const fade = fading && di >= DAYS - 3 ? 0.42 + random() * 0.12 : 1;
            const noise = 0.9 + random() * 0.2;
            const dayScale = scale * noise * (1 + Math.sin(di / 2.4) * 0.12);

            const impressions = Math.round(9000 * dayScale);
            const ctr = baseCtr * fade * noise;
            const clicks = Math.max(0, Math.round((impressions * ctr) / 100));
            const engagementRate = baseEngagement * fade * noise;
            const engagements = Math.round((impressions * engagementRate) / 100);
            const frequency = shape.frequency * (fading && di >= DAYS - 3 ? 1.35 : 1) * noise;
            const reach = Math.round(impressions / Math.max(1.05, frequency));
            const cpm = shape.cpm * (0.85 + random() * 0.35);
            const spend = Number(((impressions / 1000) * cpm).toFixed(2));

            return { date, impressions, clicks, engagements, reach, spend, frequency };
          }),
        });
      }
    }
  });

  return { dates, adSets };
}

const DATA = build();

export const DATES = DATA.dates;
export const LATEST = DATA.dates[DATA.dates.length - 1];
export const AD_SETS = DATA.adSets;

export const BRAND_LIST = BRANDS.map((b) => ({ key: b.key, label: b.key }));

/** Split one day's totals across platforms, deterministically. */
function platformSlice(row, platform) {
  if (!platform || platform === "all") return row;

  const p = PLATFORMS.find((x) => x.key === platform);
  if (!p) return row;

  const take = (v) => Math.round(v * p.share);
  return {
    ...row,
    impressions: take(row.impressions),
    clicks: take(row.clicks),
    engagements: take(row.engagements),
    reach: take(row.reach),
    spend: Number((row.spend * p.share).toFixed(2)),
  };
}

/** Ad sets for a brand, with their daily rows cut to one platform. */
export function adSetsFor(brand = "all", platform = "all") {
  return AD_SETS.filter((a) => brand === "all" || a.brand === brand).map((a) => ({
    ...a,
    daily: a.daily.map((row) => platformSlice(row, platform)),
  }));
}

/** Sum a span of days into one set of totals plus the rates they imply. */
export function totals(daily, from = 0, to = daily.length) {
  const span = daily.slice(from, to);
  const sum = (key) => span.reduce((acc, row) => acc + row[key], 0);

  const impressions = sum("impressions");
  const clicks = sum("clicks");
  const engagements = sum("engagements");
  const reach = sum("reach");
  const spend = Number(sum("spend").toFixed(2));

  return {
    days: span.length,
    impressions,
    clicks,
    engagements,
    reach,
    spend,
    ctr: impressions ? (clicks / impressions) * 100 : 0,
    engagement_rate: impressions ? (engagements / impressions) * 100 : 0,
    cpm: impressions ? (spend / impressions) * 1000 : 0,
    frequency: reach ? impressions / reach : 0,
  };
}
