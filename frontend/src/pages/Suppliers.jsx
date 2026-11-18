import { useState } from 'react';
import { api } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { Card, Message, StatusBadge } from '../components/ui';

const EMPTY = { name: '', email: '', gstNumber: '', phone: '', category: 'IT Equipment', address: '' };

export default function Suppliers() {
  const [filter, setFilter] = useState('');
  const { data: suppliers, error, reload } = useFetch(() => api.suppliers.list({ status: filter }), [filter]);
  const { data: categories } = useFetch(() => api.suppliers.categories(), []);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState({});

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      const s = await api.suppliers.create(form);
      setMsg({ success: `Supplier ${s.id} registered` });
      setForm(EMPTY);
      reload();
    } catch (err) {
      setMsg({ error: new Error(`${err.message} ${(err.data?.details || []).join('; ')}`) });
    }
  };

  const toggle = async (s) => {
    try {
      await api.suppliers.setStatus(s.id, s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
      reload();
    } catch (err) { setMsg({ error: err }); }
  };

  const rate = async (s) => {
    const r = prompt(`Rate ${s.name} (1-5)`);
    if (!r) return;
    try { await api.suppliers.rate(s.id, Number(r)); reload(); } catch (err) { setMsg({ error: err }); }
  };

  return (
    <>
      <h2>Supplier Management</h2>
      <Message {...msg} />
      <Card title="Register Supplier">
        <form className="form-grid" onSubmit={submit}>
          <label>Name<input value={form.name} onChange={set('name')} required /></label>
          <label>Email<input type="email" value={form.email} onChange={set('email')} required /></label>
          <label>GST Number<input value={form.gstNumber} onChange={set('gstNumber')} placeholder="29ABCDE1234F1Z5" required /></label>
          <label>Phone<input value={form.phone} onChange={set('phone')} /></label>
          <label>Category
            <select value={form.category} onChange={set('category')}>
              {(categories || []).map((c) => <option key={c.id}>{c.categoryName}</option>)}
            </select>
          </label>
          <label>Address<input value={form.address} onChange={set('address')} /></label>
          <div><button type="submit" className="btn primary">Register</button></div>
        </form>
      </Card>

      <Card
        title="Supplier Directory"
        actions={(
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All statuses</option><option>ACTIVE</option><option>INACTIVE</option>
          </select>
        )}
      >
        <Message error={error} />
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Category</th><th>GST</th><th>Email</th><th>Rating</th><th>Status</th><th /></tr></thead>
          <tbody>
            {(suppliers || []).map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td><td>{s.name}</td><td>{s.category}</td><td>{s.gstNumber}</td><td>{s.email}</td>
                <td>{s.rating.toFixed(1)} ★ ({s.reviewCount})</td>
                <td><StatusBadge status={s.status} /></td>
                <td className="actions">
                  <button className="btn" onClick={() => toggle(s)}>{s.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
                  <button className="btn" onClick={() => rate(s)}>Rate</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
