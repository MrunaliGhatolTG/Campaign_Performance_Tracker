
/**
 * The tabs, with the objective picker at the right of the same band when Alerts
 * is open — subordinate to the tabs, not a fourth one. The band sticks to the
 * top as the page scrolls.
 */
export default function Tabs({ page, setPage, counts, subTabs, subKey, setSubKey }) {
  return (
    <div className="tabs">
      <div className="tabs-inner">
        <div className="tab-row" role="tablist" aria-label="Sections">
          <button
            type="button"
            role="tab"
            className="tab"
            aria-selected={page === "overview"}
            onClick={() => setPage("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            className="tab"
            aria-selected={page === "alerts"}
            onClick={() => setPage("alerts")}
          >
            Alerts
            {counts.total > 0 ? <span className="count">{counts.total}</span> : null}
          </button>
          <button
            type="button"
            role="tab"
            className="tab"
            aria-selected={page === "schedule"}
            onClick={() => setPage("schedule")}
          >
            Scheduled delivery
          </button>
        </div>

        {page === "alerts" && subTabs?.length > 1 ? (
          <div className="tab-sub" role="tablist" aria-label="Objective">
            {subTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={subKey === t.key}
                onClick={() => setSubKey(t.key)}
              >
                {t.label}
                {t.flagged > 0 ? <span className="count">{t.flagged}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
