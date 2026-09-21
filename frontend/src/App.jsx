import { useEffect, useState } from "react";
import { ALERTS, isEnabled } from "./lib/alerts.js";
import { groupsIn, sliceFor } from "./lib/groups.js";
import { groupByKey } from "./lib/metrics.js";
import { useAlert } from "./hooks/useAlert.js";
import { useSchedule } from "./hooks/useSchedule.js";
import { useFilters } from "./hooks/useFilters.js";
import Chips from "./components/Chips.jsx";
import Tabs from "./components/Tabs.jsx";
import Rail from "./components/Rail.jsx";
import { Notice, Skeleton } from "./components/States.jsx";
import FatiguePage from "./pages/FatiguePage.jsx";
import BenchmarkPage from "./pages/BenchmarkPage.jsx";
import Overview from "./pages/Overview.jsx";
import SchedulePage from "./pages/SchedulePage.jsx";

const SCHEDULE_LEDE =
  "The morning brief: when it goes out, who receives it, and what it covers.";

const OVERVIEW_LEDE = isEnabled("fatigue")
  ? "Both alerts for the selected brand on the latest reporting day, by brand and objective."
  : "Every ad set against the benchmark for its own objective, and which brands and objectives the flags are landing on.";

export default function App({ sample = false }) {
  const [page, setPage] = useState("overview");
  const [alertKey, setAlertKey] = useState("ctr");
  const [groupKey, setGroupKey] = useState(null);
  const filters = useFilters();
  const { brand, platform } = filters;

  // The overview needs both; an alert page needs only the one on screen, so the
  // other is never queried until it is opened.
  const ctr = useAlert(ALERTS.ctr, {
    brand,
    platform,
    enabled: page === "overview" || alertKey === "ctr",
  });
  // The hook still exists so nothing downstream has to care; with fatigue off
  // it is never enabled, so the endpoint is never called.
  const fatigueOn = isEnabled("fatigue");
  const fatigue = useAlert(ALERTS.fatigue, {
    brand,
    platform,
    enabled: fatigueOn && (page === "overview" || alertKey === "fatigue"),
  });

  const onOverview = page === "overview";
  const onSchedule = page === "schedule";
  const active = alertKey === "fatigue" && fatigueOn ? fatigue : ctr;

  const scheduleState = useSchedule({ enabled: onSchedule });

  const loading = onSchedule
    ? scheduleState.loading
    : onOverview
      ? ctr.loading || (fatigueOn && fatigue.loading)
      : active.loading;
  const error = onSchedule
    ? filters.error
    : filters.error ||
      (onOverview ? ctr.error || (fatigueOn ? fatigue.error : null) : active.error);
  const ready = onOverview ? ctr.result || fatigue.result : active.result;

  // The brand is already named in the spec bar right below, so the heading
  // stays short.
  // Alerts are segregated by objective: one sub-tab per objective present in
  // the response, each judged on its own metric.
  const groups = groupsIn(ctr.result);
  const activeGroup =
    groups.find((g) => g.key === groupKey) ||
    groups.find((g) => g.flagged > 0) ||
    groups[0] ||
    null;
  const slice =
    ctr.result && activeGroup ? sliceFor(ctr.result, activeGroup, ctr.settings) : ctr.result;

  const title = onSchedule
    ? "Scheduled delivery"
    : onOverview
      ? "Overview"
      : activeGroup && active === ctr
        ? `${activeGroup.label} below benchmark`
        : active.alert.title;

  const groupLede =
    activeGroup && active === ctr
      ? `Ad sets bought for ${activeGroup.label.toLowerCase()}, judged on ` +
        `${groupByKey(activeGroup.key).metric === "ctr" ? "CTR" : groupByKey(activeGroup.key).metric === "reach" ? "reach" : "engagement rate"} ` +
        "against the benchmark you set for it."
      : null;

  const lede = onSchedule
    ? SCHEDULE_LEDE
    : onOverview
      ? OVERVIEW_LEDE
      : groupLede || active.alert.lede;

  // Switching tab should start at the top of the new section, not wherever the
  // previous one was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [page, alertKey, groupKey]);

  const counts = {
    ctr: ctr.result?.ads_alerting || 0,
    fatigue: fatigueOn ? fatigue.result?.ads_alerting || 0 : 0,
    total: (ctr.result?.ads_alerting || 0) + (fatigueOn ? fatigue.result?.ads_alerting || 0 : 0),
  };

  const run = () => {
    if (onSchedule) return;
    if (onOverview) {
      ctr.run();
      if (fatigueOn) fatigue.run();
    } else {
      active.run();
    }
  };

  return (
    <div className="shell">
      <Rail
        {...filters}
        brand={brand || ""}
        fields={
          onOverview || onSchedule
            ? null
            : activeGroup && active === ctr
              ? active.alert.settings.filter((f) => f.key === groupByKey(activeGroup.key).metric)
              : active.alert.settings
        }
        settings={active.settings}
        setSettings={active.setSettings}
        onRun={onSchedule ? null : run}
        runLabel={onOverview && fatigueOn ? "Refresh both" : "Run alert"}
        loading={loading}
      />

      <main className="main">
        <Tabs
          page={page}
          setPage={setPage}
          counts={counts}
          subTabs={groups}
          subKey={activeGroup?.key}
          setSubKey={setGroupKey}
        />

        <div className="masthead">
          <h1>{title}</h1>
          <div className="lede">{lede}</div>
          {onSchedule || onOverview ? null : <Chips result={ready} />}
        </div>

        {error ? (
          <Notice title={error.title} bad>
            {error.detail}
          </Notice>
        ) : null}

        {loading && !ready && !onSchedule ? <Skeleton /> : null}

        {onSchedule ? (
          <SchedulePage
            schedule={scheduleState.schedule}
            setSchedule={scheduleState.setSchedule}
            brands={filters.brands}
            state={scheduleState}
            sample={sample}
          />
        ) : null}

        {!onSchedule && onOverview && ready ? (
          <Overview ctr={ctr.result} fatigue={fatigueOn ? fatigue.result : null} />
        ) : null}

        {!onSchedule && !onOverview && active === ctr && ctr.result ? (
          <BenchmarkPage data={slice} thresholds={ctr.settings} />
        ) : null}

        {!onSchedule && !onOverview && alertKey === "fatigue" && fatigueOn && fatigue.result ? (
          <FatiguePage data={fatigue.result} />
        ) : null}
      </main>
    </div>
  );
}
