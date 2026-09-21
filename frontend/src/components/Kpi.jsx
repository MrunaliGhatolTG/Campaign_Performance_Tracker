export default function Kpi({ label, value, unit, sub, tone }) {
  return (
    <div className={`kpi ${tone || ""}`}>
      <h4>{label}</h4>
      <div className="val">
        {value}
        {unit ? <small>{unit}</small> : null}
      </div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}
