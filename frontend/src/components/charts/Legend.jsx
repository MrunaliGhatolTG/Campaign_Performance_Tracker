export default function Legend({ series }) {
  return (
    <span className="chart-legend">
      {series.map((s) => (
        <span className="swatch" key={s.key}>
          <i style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </span>
  );
}
