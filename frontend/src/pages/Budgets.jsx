import { useState } from 'react';
import { api, inr } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { Card, Message, Progress, StatusBadge } from '../components/ui';

export default function Budgets() {
  const { data: budgets, error, reload } = useFetch(() => api.budgets.list(), [], 5000);
  const { data: alerts } = useFetch(() => api.budgets.alerts(), [], 10000);
  const { data: reservations } = useFetch(() => api.budgets.reservations(), [], 5000);
  const [form, setForm] = useState({ department: '', allocatedAmount: '', alertThreshold: 80 });
  const [msg, setMsg] = useState({});

  const create = async (e) => {
    e.preventDefault();
    try {
      const b = await api.budgets.create({
        ...form, allocatedAmount: Number(form.allocatedAmount), alertThreshold: Number(form.alertThreshold),
      });
      setMsg({ success: `Budget created for ${b.department}` });
      setForm({ department: '', allocatedAmount: '', alertThreshold: 80 });
      reload();
    } catch (err) { setMsg({ error: err }); }
  };

  return (
    <>
      <h2>Departmental Budgets</h2>
      <Message {...msg} />
      <Message error={error} />
      <Card title="Allocate Budget">
        <form className="form-grid" onSubmit={create}>
          <label>Department<input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required /></label>
          <label>Allocated amount (₹)<input type="number" min="0" value={form.allocatedAmount} onChange={(e) => setForm({ ...form, allocatedAmount: e.target.value })} required /></label>
          <label>Alert threshold (%)<input type="number" min="1" max="100" value={form.alertThreshold} onChange={(e) => setForm({ ...form, alertThreshold: e.target.value })} /></label>
          <div><button className="btn primary" type="submit">Create</button></div>
        </form>
      </Card>

      <Card title="Budgets (Available = Allocated − Consumed − Reserved)">
        <table>
          <thead><tr><th>Department</th><th>FY</th><th>Allocated</th><th>Consumed</th><th>Reserved</th><th>Available</th><th>Utilisation</th></tr></thead>
          <tbody>
            {(budgets || []).map((b) => (
              <tr key={b.id}>
                <td>{b.department}</td><td>{b.fiscalYear}</td><td>{inr(b.allocatedAmount)}</td>
                <td>{inr(b.consumedAmount)}</td><td>{inr(b.reservedAmount)}</td><td><strong>{inr(b.availableAmount)}</strong></td>
                <td><Progress value={b.utilizationPercent} threshold={b.alertThreshold} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid-2">
        <Card title="Threshold Alerts">
          <table>
            <thead><tr><th>Department</th><th>Utilisation</th><th>Threshold</th><th>When</th></tr></thead>
            <tbody>
              {(alerts || []).map((a) => (
                <tr key={a.id}><td>{a.department}</td><td>{a.utilization}%</td><td>{a.threshold}%</td><td>{new Date(a.createdAt).toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Reservations">
          <table>
            <thead><tr><th>PO</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {(reservations || []).map((r) => (
                <tr key={r.reservationId}><td>{r.poId}</td><td>{inr(r.amount)}</td><td><StatusBadge status={r.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
