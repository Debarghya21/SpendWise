export function KpiCard({ label, value, hint }) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${String(status || '').toLowerCase()}`}>{status}</span>;
}

export function Progress({ value, threshold = 80 }) {
  const v = Math.min(100, Number(value || 0));
  const cls = v >= 100 ? 'danger' : v >= threshold ? 'warn' : 'ok';
  return (
    <div className="progress" title={`${v}%`}>
      <div className={`progress-bar ${cls}`} style={{ width: `${v}%` }} />
      <span>{v.toFixed(1)}%</span>
    </div>
  );
}

export function Message({ error, success }) {
  if (error) return <div className="msg msg-error">{error.message || String(error)}</div>;
  if (success) return <div className="msg msg-success">{success}</div>;
  return null;
}

export function Card({ title, actions, children }) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card-header">
          <h3>{title}</h3>
          <div>{actions}</div>
        </header>
      )}
      {children}
    </section>
  );
}
