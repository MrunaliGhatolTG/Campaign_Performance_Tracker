import { useState } from "react";
import { ALERT_LIST } from "../lib/alerts.js";
import { digestPreviewUrl } from "../lib/api.js";
import { Notice } from "../components/States.jsx";

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

// Somewhere to start; the field takes any IANA name the server accepts.
const ZONES = ["Africa/Lagos", "Asia/Kolkata", "Europe/London", "America/New_York", "UTC"];

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

export default function SchedulePage({ schedule, setSchedule, brands, state, sample }) {
  const { dirty, loading, loadError, saving, saveError, savedAt, save } = state;
  const [draft, setDraft] = useState("");
  const [addError, setAddError] = useState(null);

  const set = (key) => (value) => setSchedule((p) => ({ ...p, [key]: value }));

  const toggleDay = (key) =>
    setSchedule((p) => ({
      ...p,
      days: p.days.includes(key) ? p.days.filter((d) => d !== key) : [...p.days, key],
    }));

  const addRecipient = () => {
    const email = draft.trim();
    if (!email) return;
    if (!EMAIL.test(email)) return setAddError("That does not look like an email address.");
    if (schedule.recipients.includes(email)) return setAddError("That address is already on the list.");

    setSchedule((p) => ({ ...p, recipients: [...p.recipients, email] }));
    setDraft("");
    setAddError(null);
  };

  const removeRecipient = (email) =>
    setSchedule((p) => ({ ...p, recipients: p.recipients.filter((r) => r !== email) }));

  const noRecipients = schedule.enabled && schedule.recipients.length === 0;
  const noDays = schedule.enabled && schedule.days.length === 0;

  return (
    <div className="results">
      {sample ? (
        <Notice title="Demo — scheduled delivery is switched off here">
          This is a demonstration running on sample data, so the schedule below can
          be explored but nothing is saved and no email is sent. In the live
          deployment the brief is emailed automatically on the schedule you set.
        </Notice>
      ) : null}

      {loadError ? (
        <Notice title={loadError.title}>
          {loadError.detail} Nothing is scheduled until a save succeeds. The page expects{" "}
          <code>GET</code> and <code>PUT /api/digest/schedule</code>.
        </Notice>
      ) : null}

      <div className="panel">
        <header>
          <h2>When it goes out</h2>
          <span className="note">{loading ? "Loading…" : schedule.enabled ? "On" : "Paused"}</span>
        </header>
        <div className="body">
          <label className="switch">
            <input
              type="checkbox"
              checked={schedule.enabled}
              onChange={(e) => set("enabled")(e.target.checked)}
            />
            <span>Send the morning brief on this schedule</span>
          </label>

          <div className="form-grid">
            <div className="f">
              <label className="f-label" htmlFor="time">
                Time
              </label>
              <input
                id="time"
                className="f-input"
                type="time"
                value={schedule.time}
                onChange={(e) => set("time")(e.target.value)}
              />
            </div>

            <div className="f">
              <label className="f-label" htmlFor="tz">
                Timezone
              </label>
              <select
                id="tz"
                className="f-input"
                value={schedule.timezone}
                onChange={(e) => set("timezone")(e.target.value)}
              >
                {(ZONES.includes(schedule.timezone) ? ZONES : [schedule.timezone, ...ZONES]).map(
                  (z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>

          <div className="f">
            <span className="f-label">Days</span>
            <div className="day-row">
              {DAYS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  className="day"
                  aria-pressed={schedule.days.includes(d.key)}
                  onClick={() => toggleDay(d.key)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {noDays ? <p className="f-warn">Pick at least one day, or it will never send.</p> : null}
          </div>
        </div>
      </div>

      <div className="panel">
        <header>
          <h2>Who gets it</h2>
          <span className="note">
            {schedule.recipients.length} {schedule.recipients.length === 1 ? "address" : "addresses"}
          </span>
        </header>
        <div className="body">
          {schedule.recipients.length ? (
            <ul className="recipients">
              {schedule.recipients.map((r) => (
                <li key={r}>
                  <span>{r}</span>
                  <button type="button" onClick={() => removeRecipient(r)} aria-label={`Remove ${r}`}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="f-note">No one is on the list yet.</p>
          )}

          <div className="add-row">
            <input
              className="f-input"
              type="email"
              placeholder="name@company.com"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setAddError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRecipient();
                }
              }}
            />
            <button type="button" className="btn" onClick={addRecipient}>
              Add
            </button>
          </div>
          {addError ? <p className="f-warn">{addError}</p> : null}
          {noRecipients ? (
            <p className="f-warn">The schedule is on but has nowhere to send.</p>
          ) : null}
        </div>
      </div>

      <div className="panel">
        <header>
          <h2>What is in it</h2>
        </header>
        <div className="body">
          <div className="form-grid">
            <div className="f">
              <label className="f-label" htmlFor="sbrand">
                Brand
              </label>
              <select
                id="sbrand"
                className="f-input"
                value={schedule.brand}
                onChange={(e) => set("brand")(e.target.value)}
              >
                {brands.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="f">
              <span className="f-label">Alerts</span>
              <div className="day-row">
                {ALERT_LIST.map((a) => {
                  const id = a.path.split("/").pop();
                  const on = schedule.alerts.includes(id);
                  return (
                    <button
                      key={a.key}
                      type="button"
                      className="day"
                      aria-pressed={on}
                      onClick={() =>
                        setSchedule((p) => ({
                          ...p,
                          alerts: on ? p.alerts.filter((x) => x !== id) : [...p.alerts, id],
                        }))
                      }
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="f-note">
            The brief uses the same threshold as the alert page, so a change there changes what
            gets sent.
          </p>
        </div>
      </div>

      {saveError ? (
        <Notice title={saveError.title} bad>
          {saveError.detail}
        </Notice>
      ) : null}

      <div className="save-bar">
        <button type="button" className="btn primary" onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : dirty ? "Save schedule" : "Saved"}
        </button>
        <span className="f-note">
          {dirty
            ? "Unsaved changes."
            : savedAt
              ? `Saved at ${savedAt.toLocaleTimeString()}.`
              : "No changes."}
        </span>
        {sample ? (
          <span className="brief-link">Brief preview needs the API</span>
        ) : (
          <a className="brief-link" href={digestPreviewUrl} target="_blank" rel="noopener">
            Preview the morning brief
          </a>
        )}
      </div>
    </div>
  );
}
