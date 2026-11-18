import { useState } from 'react';
import { api, inr } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { Card, Message, StatusBadge } from '../components/ui';

export default function Approvals() {
  const { data: pending, error, reload } = useFetch(
    () => api.purchaseOrders.list({ status: 'PENDING_APPROVAL' }), [], 5000,
  );
  const { data: review } = useFetch(() => api.purchaseOrders.list({ status: 'PENDING_BUDGET_REVIEW' }), [], 5000);
  const [approver, setApprover] = useState('procurement.manager');
  const [msg, setMsg] = useState({});

  const decide = async (po, approve) => {
    const comment = approve ? 'Approved' : prompt('Rejection reason', 'Not required this quarter');
    if (!approve && comment === null) return;
    try {
      const fn = approve ? api.purchaseOrders.approve : api.purchaseOrders.reject;
      const res = await fn(po.purchaseOrderId, { approverId: approver, comment });
      setMsg({ success: `${res.purchaseOrderId} ${res.status}` });
      reload();
    } catch (err) { setMsg({ error: err }); }
  };

  return (
    <>
      <h2>Approvals</h2>
      <Message {...msg} />
      <Card title="Awaiting Approval (budget reserved)" actions={(
        <label>Approver <input value={approver} onChange={(e) => setApprover(e.target.value)} /></label>
      )}>
        <Message error={error} />
        <table>
          <thead><tr><th>PO</th><th>Supplier</th><th>Department</th><th>Requested by</th><th>Amount</th><th /></tr></thead>
          <tbody>
            {(pending || []).length === 0 && <tr><td colSpan={6}>No purchase orders awaiting approval.</td></tr>}
            {(pending || []).map((po) => (
              <tr key={po.id}>
                <td>{po.purchaseOrderId}</td><td>{po.supplierName}</td><td>{po.department}</td>
                <td>{po.requestedBy}</td><td>{inr(po.totalAmount)}</td>
                <td className="actions">
                  <button className="btn primary" onClick={() => decide(po, true)}>Approve</button>
                  <button className="btn danger" onClick={() => decide(po, false)}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Blocked – Pending Budget Review (cannot be approved)">
        <table>
          <thead><tr><th>PO</th><th>Department</th><th>Amount</th><th>Status</th><th>Reason</th></tr></thead>
          <tbody>
            {(review || []).map((po) => (
              <tr key={po.id}>
                <td>{po.purchaseOrderId}</td><td>{po.department}</td><td>{inr(po.totalAmount)}</td>
                <td><StatusBadge status={po.status} /></td><td className="reason">{po.statusReason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
