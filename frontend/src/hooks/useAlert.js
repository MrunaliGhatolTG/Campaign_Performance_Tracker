import { useCallback, useEffect, useRef, useState } from "react";
import { getAlert } from "../lib/api.js";

/**
 * One alert's state. Fetches when the filters change and the alert is on
 * screen, never twice for the same filters, and never on a settings keystroke —
 * a new setting is applied by pressing Run.
 */
export function useAlert(alert, { brand, platform, enabled }) {
  const [settings, setSettings] = useState(alert.defaults);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const inFlight = useRef(null);
  const fetched = useRef(null);
  const key = `${brand}|${platform}`;

  const run = useCallback(() => {
    if (!brand) return;

    inFlight.current?.abort();
    const ac = new AbortController();
    inFlight.current = ac;
    fetched.current = `${brand}|${platform}`;

    setLoading(true);
    setError(null);

    getAlert(
      alert.path,
      { brand, platform, ...alert.fixed, ...(alert.toParams ? alert.toParams(settings) : settings) },
      { signal: ac.signal },
    )
      .then((d) => {
        setResult(d);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError({ title: `${alert.title} did not run`, detail: e.message });
        setResult(null);
        setLoading(false);
      });
  }, [alert, brand, platform, settings]);

  useEffect(() => {
    if (!enabled || !brand) return;
    if (fetched.current !== key) run();
  }, [enabled, brand, key, run]);

  useEffect(() => () => inFlight.current?.abort(), []);

  return { alert, settings, setSettings, result, error, loading, run };
}
