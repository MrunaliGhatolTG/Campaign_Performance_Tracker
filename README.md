# Campaign Performance Tracker

A dashboard and alerting layer over Meta ads activity, built so that every ad
set is judged on the metric its objective was bought for rather than on
click-through rate across the board.

| Objective | Judged on |
| --- | --- |
| Awareness | Reach |
| Reach | Reach |
| Engagement | Engagement rate |
| Traffic / clicks | CTR |

Three tabs: an **Overview** of where the flags are landing by brand and
objective, **Alerts** split into one view per objective, and **Scheduled
delivery** for the morning brief.

> **Every figure in this package is invented.** Brand names and campaign naming
> conventions are real; the impressions, clicks, spend, reach and CTR are
> generated. Nothing here connects to Fabric, Meta or any other system.

## What's in the box

```
frontend/      Vite + React. Runs standalone on sample data, or against the API.
backend/       FastAPI. Answers every endpoint the frontend calls, from
               generated data. Doubles as the reference for the real contract.
screenshots/   One image per tab.
```

## Quickest look

The frontend needs nothing but Node — no backend, no database:

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

A fetch mock answers every call in the browser, and a badge in the corner says
so. `npm run build` produces a static `dist/` that behaves the same way; it
deploys to GitHub Pages through the workflow in `frontend/.github/workflows/`.

## Running both halves

```bash
# terminal 1
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload     # :8000, interactive docs at /docs

# terminal 2
cd frontend
npm run dev:api                   # proxies /api to :8000
```

Or serve the built frontend from FastAPI itself, same origin, no CORS:

```bash
cd frontend && npm run build:api
cp -r dist ../backend/static
cd ../backend && uvicorn app.main:app     # whole app at :8000
```

## Going live

Two files carry the parts that have to change.

`backend/app/sample.py` is the only module that knows the data is fake.
`rows_for()` is the seam: replace it with a SQL query against
`dbo.meta_all_brands_gold` and the rest of the service — the aggregation, the
per-objective benchmarks, the fatigue test — is already correct.

`backend/app/benchmarks.py` holds the objective-to-metric mapping and the
default benchmarks. It mirrors `frontend/src/lib/metrics.js`; keep the two in
step. The benchmark values are starting numbers and should be set against your
own history per brand.

The brief is really sent: `backend/app/scheduler.py` checks the saved schedule
every 30 seconds and mails it over SMTP when it is due, once per local day.
Point it at a mail server with `backend/.env.example`, and read
`GET /api/digest/status` when something does not arrive. It assumes a single
process; `backend/README.md` covers that and the catch-up window.

Also still to do, and deliberately absent here: authentication, and a store for
the schedule other than a JSON file.

## Decisions worth settling before the backend is written

1. Is reach the right measure for awareness buys?
2. What benchmark should each objective be held to, and should it vary by brand?
3. Is ad set the right grain to alert on, or campaign?
4. Who receives the morning brief, and when?

Each README goes deeper: `frontend/README.md` covers the endpoints the UI calls
and what a response has to contain for a non-CTR metric to display;
`backend/README.md` covers the endpoints, the fatigue test and the seam.
