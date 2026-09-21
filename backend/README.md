# Campaign Performance Tracker — sample API

A FastAPI service that answers every endpoint the frontend calls, computed from
an invented dataset. Two uses:

1. run the frontend against a real HTTP API instead of its in-browser mock;
2. hand it to whoever wires up Fabric as a working reference for the contract.

Every figure is fabricated. Nothing here connects to Fabric, Meta or anything
else.

## Run it

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload        # http://127.0.0.1:8000
```

Interactive docs at `/docs`, health at `/api/health`.

With the frontend in another terminal:

```bash
cd ../frontend
npm run dev:api                      # proxies /api to :8000
```

Or serve the built frontend from this app — copy its `dist/` to `static/` here
and it is mounted at `/`, same origin, no CORS:

```bash
cd ../frontend && npm run build:api
cp -r dist ../backend/static
```

## Endpoints

| Endpoint | Returns |
| --- | --- |
| `GET /api/brands` | brand list, default brand, row grain, table name |
| `GET /api/platforms` | platform list and whether the column exists |
| `GET /api/thresholds` | default benchmark per metric |
| `GET /api/alerts/low-ctr` | every ad set against its objective's benchmark |
| `GET /api/alerts/creative-fatigue` | ad sets whose CTR has really fallen |
| `GET /api/digest/schedule` | the delivery schedule |
| `PUT /api/digest/schedule` | saves it, validating days and addresses |
| `GET /api/digest/preview` | the morning brief as HTML |
| `GET /api/digest/status` | whether the brief will go out, and what is stopping it |
| `POST /api/digest/send-now` | sends the brief immediately, to the saved recipients |
| `GET /api/health` | row count and latest day |

`low-ctr` takes `brand`, `platform`, `threshold_ctr`,
`threshold_engagement_rate`, `threshold_reach`, and accepts `threshold_pct` as
an alias for the CTR one. `creative-fatigue` takes `brand`, `platform`,
`min_decline_pct`.

## How it works

`app/benchmarks.py` holds the objective-to-metric mapping — awareness and reach
judged on reach, engagement on engagement rate, traffic and clicks on CTR — and
mirrors `src/lib/metrics.js` in the frontend. Keep the two in step.

`app/alerts.py` is the actual logic. Low CTR aggregates the latest day per ad
set, derives reach, engagement rate and CTR, and compares each to the benchmark
for its objective. Fatigue splits the window into a baseline and the last three
days and tests the difference with a two-proportion z-test, so a drop has to be
statistically real before it is flagged and not merely large. Nothing in either
file knows the data is fake.

`app/sample.py` is the only part that does. It generates one row per ad set per
day with the columns the gold table has. **`rows_for()` is the seam**: point it
at a SQL query against `dbo.meta_all_brands_gold` and the rest of the service
is already correct. The generator is seeded, so the numbers are the same on
every run and screenshots stay reproducible.

`app/schedule.py` writes to `data/schedule.json`. Swap it for a table when this
becomes real; `last_sent`, `last_manual_sent` and `last_error` are server-set
and ignored on the way in.

## Sending the brief

`app/scheduler.py` is one asyncio task, started with the app, that wakes every
30 seconds and asks `assess()` whether the saved schedule is due in its own
timezone. When it is, it builds the brief and sends it over SMTP, then writes
`last_sent` so the same local day cannot produce a second copy.

SMTP settings come from the environment — copy `.env.example` to `.env` and run
`uvicorn app.main:app --env-file .env`. Until `SMTP_HOST` is set nothing is
sent, and `GET /api/digest/status` says so rather than failing quietly. That
endpoint is the thing to read when a brief does not arrive: it reports the
resolved SMTP settings, the next due time, and `last_error` from the last
failed attempt.

`POST /api/digest/send-now` sends immediately, to prove the wiring works. It is
recorded as `last_manual_sent`, deliberately *not* `last_sent`, so testing
delivery never consumes that day's scheduled brief.

Two things to know:

- **One process only.** Each worker would keep its own clock and send its own
  copy. For more than one, drop `_lifespan` and have an external cron call
  `POST /api/digest/send-now`, or take a lock in the store.
- **A missed slot is caught up for `DIGEST_CATCHUP_MINUTES`** (default 120).
  Past that the day counts as missed, so restarting the server in the evening
  does not fire that morning's brief.

The brief is the low-CTR benchmark run for the schedule's brand. The `alerts`
list in the schedule is stored and returned but does not yet change what the
brief contains.

## What it does not do

No authentication and no database — the schedule is a JSON file. Do not put it
on a public host expecting it to behave like a service.
