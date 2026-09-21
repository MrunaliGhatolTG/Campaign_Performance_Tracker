# Campaign Performance Tracker — frontend

Vite + React. Three tabs: Overview, Alerts, and Scheduled delivery.

**It runs on its own.** There is no backend in this package and none is needed:
the app ships with a sample dataset and a fetch mock, so `npm install && npm run
dev` gives you the whole dashboard working. Every number you see is invented —
the badge in the corner says so.

```bash
npm install
npm run dev      # http://localhost:5173, sample data, no server needed
npm run build    # -> dist/, still self-contained
npm run serve    # serve that build locally
```

`dist/` is static and makes no network calls. Put it on any static host, or run
`npm run serve`. It needs to be served over http rather than opened as a
`file://` path, because the browser blocks ES modules loaded that way.

## Putting it on GitHub Pages

Because the app runs on sample data with no backend, it deploys as a plain
static site. `.github/workflows/deploy.yml` builds on every push to `main` and
publishes it; enable Pages under Settings → Pages with "GitHub Actions" as the
source, and that is the whole setup.

A project site is served from `/<repo>/` rather than the domain root, so the
workflow passes `VITE_BASE=/<repo>/` and `vite.config.js` uses it as the asset
prefix. Local builds and same-origin serving from FastAPI keep the default `/`,
so nothing else changes.

Two things to know before you publish:

- **Repository visibility and site visibility are separate settings.** A public
  Pages site can be served from a private repo. Restricting who can *view* the
  site needs GitHub Enterprise Cloud; on other plans the URL is open to anyone
  who has it.
- **Everything in the bundle is downloadable**, including the sample fixture and
  this README. The numbers are invented, but the campaign naming conventions,
  the endpoint paths and the Fabric table name in the docs are real. Worth a
  glance before making it public.

## When you do have the API

Two scripts switch the same code over to a real FastAPI service:

```bash
npm run dev:api     # /api proxied to uvicorn on http://127.0.0.1:8000
npm run build:api   # production bundle that calls /api, sample data excluded
```

`VITE_API_TARGET` points the dev proxy somewhere other than :8000, and
`VITE_API_BASE` handles the API living on another origin. Copy `.env.example`
to `.env` if you need either. The `:api` builds leave the sample fixture out of
the bundle entirely, since it is loaded through a dynamic import.

Serving the built app from FastAPI, once it exists:

```python
from fastapi.staticfiles import StaticFiles
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="ui")
```

Mount it after the `/api` routes are registered.

## What the sample data does

`src/preview/` holds the fixture and the mock. The mock answers every endpoint
the app calls, including the delivery schedule, which it keeps in memory for the
session so the Save button behaves. Two things it cannot fake: the morning-brief
preview is a server-rendered page, so that link is replaced with a note, and
nothing survives a refresh.

Only the Below benchmark alert is switched on. Creative fatigue is written and
still in the tree — its page, chart and table — but it is out of `ALERT_LIST` in
`src/lib/alerts.js`, so nothing queries it and nothing renders it. Putting
`ALERTS.fatigue` back in that list restores its tab, the overview scatter and
its queries. Nothing else to change.

## Layout

```
src/
  main.jsx                entry; installs the mock unless VITE_API=1
  App.jsx                 section switching and page composition
  styles.css              the whole visual system, tokens on :root
  lib/alerts.js           what an alert is: path, copy, settings, fixed params
  lib/api.js              the endpoints, one place
  lib/format.js           num / pct / noun / periodLabel / signed / countOf
  hooks/useFilters.js     brand and platform lists
  hooks/useAlert.js       one alert's query, cancellation and caching
  hooks/useSchedule.js    the delivery schedule: load, edit locally, save
  lib/metrics.js          objective -> metric map, benchmarks, readings
  lib/groups.js           the objective groups and one group's slice
  lib/overviewStats.js    what the overview charts plot
  hooks/useWidth.js       container width, so charts draw type at true size
  pages/                  Overview, BenchmarkPage, FatiguePage, SchedulePage
  components/             Rail, Tabs, Chips, Kpi, Strip, BenchmarkLadder,
                          BenchmarkTable, MoveChart, FatigueTable, States
  components/charts/      Scatter, StackedBars, Legend
  preview/                sample data + fetch mock (left out of :api builds)
```

## Endpoints it calls, once there is an API

| Endpoint | Used for |
| --- | --- |
| `GET /api/brands` | brand dropdown, default brand, row grain |
| `GET /api/platforms` | platform dropdown, whether the column exists |
| `GET /api/alerts/low-ctr` | the Below benchmark page and the overview |
| `GET /api/alerts/creative-fatigue` | not called while fatigue is off |
| `GET /api/digest/preview` | the preview link on the delivery tab |
| `GET /api/digest/schedule` | loading the delivery schedule |
| `PUT /api/digest/schedule` | saving it |

Below benchmark sends `brand`, `platform`, `threshold_ctr`,
`threshold_engagement_rate`, `threshold_reach`, `threshold_mode=by_objective`,
fixed `ctr_scale=auto`, and `threshold_pct` (a copy of the CTR one, so an
endpoint that only knows about CTR keeps working). Fatigue, when switched on,
sends `brand`, `platform` and `min_decline_pct`.

## How fetching behaves

Each alert is queried only when it is on screen and switched on, so with
fatigue off the app makes one alert call per brand. Results
are kept per brand-and-platform, so moving between sections does not re-query
Fabric — changing brand or platform does. Superseded requests are cancelled, so
switching brand twice quickly can't let the first answer land on top of the
second. Settings never fire on a keystroke; Run applies them.

## Adding an alert

`winners` is already in the sample data. Add an entry to `lib/alerts.js` with
its path, copy and one setting, add a page beside the other two, and list it in
`ALERT_LIST`. The tab band, the badges and the query plumbing pick it up.

The overview adapts to how many alerts are on: with one, the stacked charts
collapse to a single series, the fatigue scatter and its summary card drop out,
and the last chart spans the full width rather than leaving a hole.

## Known rough edge

Spend figures render as bare numbers because the API doesn't say what currency
the gold layer holds. Same for the alert sentences, which the backend composes
with the raw Meta objective (`OUTCOME_AWARENESS`) in flat mode — the UI
humanises its own columns but doesn't rewrite server text, since that text also
goes out in the morning brief.

## Scheduled delivery — the endpoints it needs

This tab is built against two endpoints that do not exist in the backend yet.
Both carry the same object:

```json
{
  "enabled": true,
  "time": "07:30",
  "timezone": "Africa/Lagos",
  "days": ["mon", "tue", "wed", "thu", "fri"],
  "recipients": ["campaign.team@tolaram.com"],
  "brand": "all",
  "alerts": ["low-ctr"],
  "last_sent": "2026-08-30T07:30:00+01:00"
}
```

`GET /api/digest/schedule` returns it. `PUT /api/digest/schedule` takes it
without `last_sent` (read-only, server-set) and returns the saved object;
returning an empty body is fine, the UI keeps what it sent. Errors should carry
a FastAPI-style `detail`, which the page shows verbatim.

`brand` is `all` or a brand key from `/api/brands`. `alerts` holds the last
path segment of each alert endpoint, so `low-ctr` and, once it is switched on,
`creative-fatigue`.

Until those exist, the tab loads with a notice saying nothing was read, the
form still works, and Save reports whatever the server said. Edits stay local
until Save, so a half-typed address is never sent.

## Alerts are segregated by objective

The Alerts tab holds one sub-tab per objective present in the response —
Awareness, Reach, Engagement, Clicks — and each shows only the ad sets bought
for it, judged on that objective's metric:

| Objective | Judged on |
| --- | --- |
| Awareness | Reach |
| Reach | Reach |
| Engagement | Engagement rate |
| Traffic / clicks | CTR |

A row whose objective is missing or unrecognised falls in with Clicks, the same
fallback the metric map uses.

Because a group holds one metric, its ladder uses that metric's own axis (reach
in people, CTR in percent) with the real benchmark line, its table drops the
Objective and Judged-on columns into the header, and the rail shows only that
group's threshold field. The Overview stays portfolio-wide and mixed, so its
histogram is in percent of benchmark.

Grouping is in `src/lib/groups.js`; `groupsIn` finds the objectives present and
`sliceFor` cuts the response down to one of them. The mapping lives in
`src/lib/metrics.js` — one `RULES` table matching the
objective string, plus a `METRICS` entry per metric holding its label, format,
default benchmark and the label of its threshold field. Adding a metric (video
views, say) is an entry in each.

**What the API has to return.** For a row to be judged on anything but CTR, its
finding and distribution entries need three fields:

```json
{ "metric": "reach", "value": 7800, "threshold": 10000 }
```

`metric` is `reach`, `engagement_rate` or `ctr`. Send `objective` too and the
UI can derive the metric itself when `metric` is missing. With none of them, a
row falls back to `ctr` / `threshold_pct` and behaves exactly as before, so
this frontend works against the endpoint as it stands today — it just can't
show a reach reading the server never sent.

If the response's `threshold_mode` comes back as anything other than
`by_objective`, the page says plainly that the server judged everything on CTR.

**Why the ladder is in percent.** Reach is a count and CTR is a rate, so they
can't share an axis. Every row is drawn as a share of its own benchmark, 100%
being the line, with the raw reading beside it.
