export function Notice({ title, children, bad }) {
  return (
    <div className={`notice ${bad ? "bad" : ""}`}>
      <h4>{title}</h4>
      <p>{children}</p>
    </div>
  );
}

export function Skeleton({ label = "Querying Fabric…" }) {
  return (
    <div className="panel">
      <div className="skeleton">
        <span className="spinner" />
        {label}
      </div>
    </div>
  );
}
