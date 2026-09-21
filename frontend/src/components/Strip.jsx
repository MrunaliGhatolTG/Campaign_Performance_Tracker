export default function Strip({ segments, total, ofLabel }) {
  const sum = segments.reduce((a, s) => a + s.count, 0) || 1;

  return (
    <div className="strip">
      <div className="top">
        <h3>Portfolio composition</h3>
        <span className="of">
          {total} {ofLabel}
        </span>
      </div>

      <div className="bar">
        {segments.map((s) =>
          s.count > 0 ? (
            <span
              key={s.key}
              className={`s-${s.key}`}
              style={{ flexGrow: s.count / sum }}
              title={`${s.label}: ${s.count}`}
            />
          ) : null,
        )}
      </div>

      <div className="legend">
        {segments.map((s) => (
          <span key={s.key} className="item">
            <i className={`s-${s.key}`} style={{ background: s.color }} />
            {s.label} <b>{s.count}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
