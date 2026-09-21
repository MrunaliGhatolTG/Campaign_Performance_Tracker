import BrandMark from "./BrandMark.jsx";

/** Identity, then everything you can change. */
export default function Rail({
  brands,
  brand,
  setBrand,
  platforms,
  platform,
  setPlatform,
  platformAvailable,
  fields,
  settings,
  setSettings,
  onRun,
  runLabel,
  loading,
}) {
  const onePlatform = platforms.length <= 1;

  return (
    <aside className="rail">
      <div className="brand">
        <span className="mark">
          <BrandMark />
        </span>
        <span className="word">
          <b>Campaign Performance Tracker</b>
          <span>Meta ads</span>
        </span>
      </div>

      <div className="controls">
        <div className="control">
          <label htmlFor="brand">Brand</label>
          <select id="brand" value={brand} onChange={(e) => setBrand(e.target.value)}>
            {brands.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div className="control">
          <label htmlFor="platform">Platform</label>
          <select
            id="platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            disabled={onePlatform}
          >
            {platforms.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          {platformAvailable === false ? (
            <p className="hint">
              This table has no platform column, so results cover every placement.
            </p>
          ) : null}
        </div>

        {(fields || []).map((f) => (
          <div className="control" key={f.id}>
            <label htmlFor={f.id}>{f.label}</label>
            <input
              id={f.id}
              type="number"
              step={f.step}
              min={f.min}
              max={f.max}
              value={settings[f.key]}
              onChange={(e) => setSettings((p) => ({ ...p, [f.key]: e.target.value }))}
            />
            <p className="hint">{f.hint}</p>
          </div>
        ))}

        {onRun ? (
          <button className="run" onClick={onRun} disabled={loading}>
            {loading ? "Running…" : runLabel}
          </button>
        ) : null}
      </div>

    </aside>
  );
}
