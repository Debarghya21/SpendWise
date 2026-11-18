import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api, inr } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { Card, Message } from '../components/ui';

const COLORS = ['#0a6ed1', '#e9730c', '#107e3e', '#bb0000', '#6c32a9', '#0f828f', '#925ace'];

async function load() {
  const [monthly, departments, categories, suppliers, anomalies] = await Promise.all([
    api.analytics.monthly(), api.analytics.departments(), api.analytics.categories(),
    api.analytics.suppliers(), api.analytics.anomalies(),
  ]);
  return { monthly, departments, categories, suppliers, anomalies };
}

export default function Analytics() {
  const { data, error } = useFetch(load, [], 10000);
  const d = data || {};
  return (
    <>
      <h2>Spend Analytics</h2>
      <Message error={error} />
      <div className="grid-2">
        <Card title="Monthly Spend Trend">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={d.monthly}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis />
              <Tooltip formatter={(v) => inr(v)} />
              <Line type="monotone" dataKey="totalSpend" stroke="#0a6ed1" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Department-wise Spending">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.departments}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="department" /><YAxis />
              <Tooltip formatter={(v) => inr(v)} /><Bar dataKey="totalSpend" fill="#0a6ed1" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Category-wise Spending">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={d.categories} dataKey="totalSpend" nameKey="category" outerRadius={90} label>
                {(d.categories || []).map((c, i) => <Cell key={c.category} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => inr(v)} /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Supplier-wise Spending">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.suppliers} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="supplierName" width={140} />
              <Tooltip formatter={(v) => inr(v)} /><Bar dataKey="totalSpend" fill="#e9730c" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Supplier Performance">
        <table>
          <thead><tr><th>Supplier</th><th>Category</th><th>Approved POs</th><th>Rejected / Cancelled</th><th>Approval rate</th><th>Total spend</th></tr></thead>
          <tbody>
            {(d.suppliers || []).map((s) => (
              <tr key={s.supplierId}>
                <td>{s.supplierName}</td><td>{s.category}</td><td>{s.purchaseOrderCount}</td>
                <td>{s.rejectedOrCancelledCount || 0}</td><td>{s.approvalRate ?? '—'}%</td><td>{inr(s.totalSpend)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Unusual Spending (anomaly detection)">
        <table>
          <thead><tr><th>PO</th><th>Department</th><th>Supplier</th><th>Amount</th><th>Dept. average</th><th>Severity</th><th>Why</th></tr></thead>
          <tbody>
            {(d.anomalies || []).length === 0 && <tr><td colSpan={7}>No anomalies detected.</td></tr>}
            {(d.anomalies || []).map((a) => (
              <tr key={a.purchaseOrderId}>
                <td>{a.purchaseOrderId}</td><td>{a.department}</td><td>{a.supplierName}</td><td>{inr(a.amount)}</td>
                <td>{inr(a.departmentAverage)}</td><td><span className={`badge badge-${a.severity.toLowerCase()}`}>{a.severity}</span></td>
                <td className="reason">{a.reasons.join('; ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
