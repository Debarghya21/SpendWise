import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api, inr } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { Card, KpiCard, Message, Progress } from '../components/ui';

async function loadDashboard() {
  const [overview, budgets, suppliers, pending, monthly, departments] = await Promise.allSettled([
    api.analytics.overview(), api.budgets.list(), api.suppliers.list({ status: 'ACTIVE' }),
    api.purchaseOrders.list({ status: 'PENDING_APPROVAL' }), api.analytics.monthly(), api.analytics.departments(),
  ]);
  const val = (r, d) => (r.status === 'fulfilled' ? r.value : d);
  return {
    overview: val(overview, {}),
    budgets: val(budgets, []),
    suppliers: val(suppliers, []),
    pending: val(pending, []),
    monthly: val(monthly, []),
    departments: val(departments, []),
    failures: [overview, budgets, suppliers, pending].filter((r) => r.status === 'rejected').length,
  };
}

export default function Dashboard() {
  const { data, error, loading } = useFetch(loadDashboard, [], 10000);
  if (loading) return <p>Loading dashboard…</p>;
  const d = data || {};
  const allocated = (d.budgets || []).reduce((s, b) => s + b.allocatedAmount, 0);
  const used = (d.budgets || []).reduce((s, b) => s + b.consumedAmount + b.reservedAmount, 0);
  const utilization = allocated ? (used / allocated) * 100 : 0;

  return (
    <>
      <h2>Procurement Dashboard</h2>
      <Message error={error} />
      {d.failures > 0 && <div className="msg msg-warn">{d.failures} service(s) unavailable – showing partial data.</div>}
      <div className="kpi-grid">
        <KpiCard label="Total Organisational Spend" value={inr(d.overview?.totalSpend)} />
        <KpiCard label="Purchase Orders" value={d.overview?.totalPurchaseOrders ?? 0} hint={`${d.overview?.approvedPurchaseOrders ?? 0} approved`} />
        <KpiCard label="Active Suppliers" value={d.suppliers?.length ?? 0} />
        <KpiCard label="Total Allocated Budget" value={inr(allocated)} />
        <KpiCard label="Budget Utilisation" value={`${utilization.toFixed(1)}%`} />
        <KpiCard label="Pending Approvals" value={d.pending?.length ?? 0} />
        <KpiCard label="Top Spending Department" value={d.overview?.topDepartment || '—'} />
      </div>

      <div className="grid-2">
        <Card title="Monthly Spend Trend">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={d.monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v) => inr(v)} />
              <Line type="monotone" dataKey="totalSpend" stroke="#0a6ed1" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Top Spending Departments">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.departments}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" />
              <YAxis />
              <Tooltip formatter={(v) => inr(v)} />
              <Bar dataKey="totalSpend" fill="#0a6ed1" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Budget Utilisation by Department">
        <table>
          <thead><tr><th>Department</th><th>Allocated</th><th>Available</th><th>Utilisation</th></tr></thead>
          <tbody>
            {(d.budgets || []).map((b) => (
              <tr key={b.id}>
                <td>{b.department}</td><td>{inr(b.allocatedAmount)}</td><td>{inr(b.availableAmount)}</td>
                <td><Progress value={b.utilizationPercent} threshold={b.alertThreshold} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
