export const num = (v, d = 0) =>
  v === null || v === undefined || Number.isNaN(v)
    ? "—"
    : Number(v).toLocaleString(undefined, {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });

export const pct = (v, d = 2) =>
  v === null || v === undefined ? "—" : `${Number(v).toFixed(d)}%`;

// Rows may be ads or ad sets depending on the table's grain, so the interface
// takes its noun from the API rather than assuming.
export function noun(data) {
  const one = (data && data.entity_label) || "Ad";
  return {
    one,
    many: `${one}s`,
    lower: one.toLowerCase(),
    lowerMany: `${one.toLowerCase()}s`,
  };
}

export const brandLabel = (v) =>
  !v ? "—" : String(v).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Meta sends OUTCOME_TRAFFIC; people read "Traffic".
export const objectiveLabel = (v) =>
  !v
    ? null
    : String(v)
        .replace(/^OUTCOME[_-]/i, "")
        .replace(/[_-]+/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());

// Low CTR reports one day; fatigue reports a window. Both answer "when".
export const periodLabel = (data) => {
  if (!data) return "—";
  if (data.period) return data.period;
  if (data.window_start && data.latest_period) {
    return `${data.window_start} to ${data.latest_period}`;
  }
  return data.latest_period || "—";
};

// A change with its direction attached: -50.7 down, +12 up.
export const signed = (v, d = 1) =>
  v === null || v === undefined ? "—" : `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(d)}%`;

// "1 ad set" / "3 ad sets" — the noun comes from the API, the count decides.
export const countOf = (n, data) =>
  `${num(n)} ${Math.abs(Number(n)) === 1 ? noun(data).lower : noun(data).lowerMany}`;
