import { useCallback, useEffect, useRef, useState } from "react";
import { getSchedule, saveSchedule } from "../lib/api.js";

export const BLANK = {
  enabled: false,
  time: "07:30",
  timezone: "Africa/Lagos",
  days: ["mon", "tue", "wed", "thu", "fri"],
  recipients: [],
  brand: "all",
  alerts: ["low-ctr"],
};

/**
 * The delivery schedule. Loads once; edits stay local until Save, so a
 * half-typed address is never sent to the server.
 */
export function useSchedule({ enabled }) {
  const [schedule, setSchedule] = useState(BLANK);
  const [serverState, setServerState] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const loaded = useRef(false);

  useEffect(() => {
    if (!enabled || loaded.current) return;
    loaded.current = true;

    const ac = new AbortController();
    setLoading(true);

    getSchedule({ signal: ac.signal })
      .then((d) => {
        const next = { ...BLANK, ...d };
        setSchedule(next);
        setServerState(next);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        // No schedule endpoint yet, or it failed: the form still works, the
        // page says plainly that nothing was loaded.
        setLoadError({ title: "No saved schedule was loaded", detail: e.message });
        setLoading(false);
      });

    return () => ac.abort();
  }, [enabled]);

  const dirty = JSON.stringify(schedule) !== JSON.stringify(serverState);

  const save = useCallback(() => {
    setSaving(true);
    setSaveError(null);

    const { last_sent: _ignored, ...payload } = schedule;

    saveSchedule(payload)
      .then((d) => {
        const next = { ...BLANK, ...(d && Object.keys(d).length ? d : payload) };
        setSchedule(next);
        setServerState(next);
        setSavedAt(new Date());
        setSaving(false);
      })
      .catch((e) => {
        setSaveError({ title: "The schedule was not saved", detail: e.message });
        setSaving(false);
      });
  }, [schedule]);

  return {
    schedule,
    setSchedule,
    dirty,
    loading,
    loadError,
    saving,
    saveError,
    savedAt,
    save,
  };
}
