// Dev: Vite proxies /api to FastAPI. Prod: FastAPI serves this app same-origin.
// Set VITE_API_BASE only if the API lives on a different host.
const BASE = import.meta.env.VITE_API_BASE ?? "";

async function getJSON(path, { params, signal } = {}) {
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  let res;
  try {
    res = await fetch(`${BASE}${path}${qs}`, { signal });
  } catch (cause) {
    if (cause.name === "AbortError") throw cause;
    throw new Error("uvicorn does not appear to be running on this address.", { cause });
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `Request failed with ${res.status}`);
  return body;
}

export const getBrands = (opts) => getJSON("/api/brands", opts);
export const getPlatforms = (opts) => getJSON("/api/platforms", opts);
export const getThresholds = (opts) => getJSON("/api/thresholds", opts);

/** Any alert: the path and the params come from its entry in lib/alerts.js. */
export const getAlert = (path, params, opts = {}) => getJSON(path, { ...opts, params });

// The emailed morning brief is a server feature; this just links to its preview.
export const digestPreviewUrl = `${BASE}/api/digest/preview`;

/* Scheduled delivery. The shape both calls use:
   { enabled, time: "07:30", timezone, days: ["mon",…], recipients: [email],
     brand: "all" | <brand key>, alerts: ["low-ctr"], last_sent? }
   last_sent is read-only and only ever comes back from the server. */
export const getSchedule = (opts) => getJSON("/api/digest/schedule", opts);

export async function saveSchedule(schedule, { signal } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api/digest/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedule),
      signal,
    });
  } catch (cause) {
    if (cause.name === "AbortError") throw cause;
    throw new Error("uvicorn does not appear to be running on this address.", { cause });
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `Save failed with ${res.status}`);
  return body;
}
