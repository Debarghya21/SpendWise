import { useState } from 'react';
import { api, inr } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { Card, Message, StatusBadge } from '../components/ui';

const NEW_ITEM = { itemName: '', quantity: 1, unitPrice: '' };

export default function PurchaseOrders() {
  const { data: orders, error, reload } = useFetch(() => api.purchaseOrders.list(), [], 5000);
  const { data: suppliers } = useFetch(() => api.suppliers.list({ status: 'ACTIVE' }), []);
  const { data: budgets } = useFetch(() => api.budgets.list().catch(() => []), []);
  const [form, setForm] = useState({ supplierId: '', department: 'Engineering', description: '', submit: true });
  const [items, setItems] = useState([{ itemName: 'Laptop', quantity: 10, unitPrice: 15000 }]);
  const [msg, setMsg] = useState({});
  const [lastResponse, setLastResponse] = useState(null);

  const total = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0);
  const setItem = (idx, key) => (e) => setItems(items.map((it, i) => (i === idx ? { ...it, [key]: e.target.value } : it)));
  const departments = budgets?.length ? budgets.map((b) => b.department) : ['Engineering', 'Marketing', 'Finance', 'Operations'];

  const create = async (e) => {
    e.preventDefault();
    try {
      const res = await api.purchaseOrders.create({
        ...form,
        supplierId: form.supplierId || suppliers?.[0]?.id,
        items: items.map((i) => ({ itemName: i.itemName, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
      });
      setLastResponse(res);
      setMsg({ success: `${res.purchaseOrderId}: ${res.status} – ${res.message}` });
      reload();
    } catch (err) { setMsg({ error: err }); setLastResponse(err.data); }
  };

  const act = async (fn, po) => {
    try {
      const res = await fn(po.purchaseOrderId);
      setLastResponse(res);
      setMsg({ success: `${res.purchaseOrderId}: ${res.status}` });
      reload();
    } catch (err) { setMsg({ error: err }); }
  };

  return (
    <>
      <h2>Purchase Orders</h2>
      <Message {...msg} />
      <div className="grid-2">
        <Card title="Create Purchase Order">
          <form onSubmit={create}>
            <div className="form-grid">
              <label>Supplier
                <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                  {(suppliers || []).map((s) => <option key={s.id} value={s.id}>{s.id} – {s.name}</option>)}
                </select>
              </label>
              <label>Department
                <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  {departments.map((d) => <option key={d}>{d}</option>)}
                </select>
              </label>
              <label className="span-2">Description
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
            </div>
            <table className="compact">
              <thead><tr><th>Item</th><th>Qty</th><th>Unit price (₹)</th><th>Line total</th><th /></tr></thead>
              <tbody>
                {items.map((it, idx) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <tr key={idx}>
                    <td><input value={it.itemName} onChange={setItem(idx, 'itemName')} required /></td>
                    <td><input type="number" min="1" value={it.quantity} onChange={setItem(idx, 'quantity')} required /></td>
                    <td><input type="number" min="1" value={it.unitPrice} onChange={setItem(idx, 'unitPrice')} required /></td>
                    <td>{inr(it.quantity * it.unitPrice)}</td>
                    <td><button type="button" className="btn" onClick={() => setItems(items.filter((_, i) => i !== idx))}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row">
              <button type="button" className="btn" onClick={() => setItems([...items, NEW_ITEM])}>+ Add item</button>
              <strong>Total: {inr(total)}</strong>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={form.submit} onChange={(e) => setForm({ ...form, submit: e.target.checked })} />
              Submit immediately (validate supplier &amp; reserve budget)
            </label>
            <button type="submit" className="btn primary">Create Purchase Order</button>
          </form>
        </Card>
        <Card title="Last API response">
          <pre className="json">{lastResponse ? JSON.stringify(lastResponse, null, 2) : 'No request yet'}</pre>
        </Card>
      </div>

      <Card title="All Purchase Orders">
        <Message error={error} />
        <table>
          <thead><tr><th>PO</th><th>Supplier</th><th>Department</th><th>Amount</th><th>Status</th><th>Reason</th><th>Actions</th></tr></thead>
          <tbody>
            {(orders || []).map((po) => (
              <tr key={po.id}>
                <td>{po.purchaseOrderId}</td><td>{po.supplierName}</td><td>{po.department}</td>
                <td>{inr(po.totalAmount)}</td><td><StatusBadge status={po.status} /></td>
                <td className="reason">{po.statusReason}</td>
                <td className="actions">
                  {['DRAFT', 'PENDING_BUDGET_REVIEW'].includes(po.status) && (
                    <button className="btn" onClick={() => act(api.purchaseOrders.submit, po)}>
                      {po.status === 'DRAFT' ? 'Submit' : 'Retry budget'}
                    </button>
                  )}
                  {['DRAFT', 'PENDING_BUDGET_REVIEW', 'PENDING_APPROVAL'].includes(po.status) && (
                    <button className="btn" onClick={() => act(api.purchaseOrders.cancel, po)}>Cancel</button>
                  )}
                  {po.status === 'APPROVED' && (
                    <button className="btn" onClick={() => act(api.purchaseOrders.complete, po)}>Mark received</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
