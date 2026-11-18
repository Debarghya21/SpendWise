import { api } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { Card, StatusBadge } from '../components/ui';

const SERVICES = [
  ['API Gateway', ''],
  ['Supplier Service', 'supplier'],
  ['Purchase Order Service', 'purchase-order'],
  ['Budget Service', 'budget'],
  ['Spend Analytics Service', 'analytics'],
];

async function loadHealth() {
  const results = await Promise.allSettled(SERVICES.map(([, key]) => api.health(key)));
  return SERVICES.map(([name], i) => ({
    name,
    ok: results[i].status === 'fulfilled',
    detail: results[i].status === 'fulfilled' ? results[i].value : { error: results[i].reason?.message },
  }));
}

export default function Monitoring() {
  const { data: health } = useFetch(loadHealth, [], 3000);
  const { data: cb, error: cbError } = useFetch(() => api.purchaseOrders.circuitBreaker(), [], 2000);
  const { data: outbox } = useFetch(() => api.purchaseOrders.outbox(), [], 3000);
  const { data: events } = useFetch(() => api.analytics.events(), [], 3000);

  return (
    <>
      <h2>System Monitoring</h2>
      <div className="kpi-grid">
        {(health || []).map((h) => (
          <div key={h.name} className={`card kpi ${h.ok ? 'up' : 'down'}`}>
            <div className="kpi-label">{h.name}</div>
            <div className="kpi-value">{h.ok ? 'UP' : 'DOWN'}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <Card title="Circuit Breaker – PO → Budget Service">
          {cbError ? <p>Purchase Order Service unreachable.</p> : cb && (
            <>
              <div className={`cb-state cb-${cb.state.toLowerCase()}`}>{cb.state}</div>
              <table className="compact">
                <tbody>
                  <tr><td>Failure rate</td><td>{cb.failureRate < 0 ? 'n/a (min calls not reached)' : `${cb.failureRate}%`}</td></tr>
                  <tr><td>Buffered / failed / successful</td><td>{cb.bufferedCalls} / {cb.failedCalls} / {cb.successfulCalls}</td></tr>
                  <tr><td>Short-circuited calls</td><td>{cb.notPermittedCalls}</td></tr>
                  <tr><td>Config</td><td>window {cb.config.slidingWindowSize}, min {cb.config.minimumNumberOfCalls}, threshold {cb.config.failureRateThreshold}%, half-open {cb.config.permittedCallsInHalfOpenState}</td></tr>
                </tbody>
              </table>
            </>
          )}
        </Card>
        <Card title={`Transactional Outbox (pending: ${outbox?.pendingEvents ?? '—'})`}>
          <table className="compact">
            <thead><tr><th>Event</th><th>PO</th><th>Published</th></tr></thead>
            <tbody>
              {(outbox?.recentEvents || []).map((e) => (
                <tr key={e.eventId}><td>{e.eventType}</td><td>{e.purchaseOrderId}</td><td>{e.published ? '✔' : `pending (${e.attempts})`}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Analytics – consumed RabbitMQ events">
        <table className="compact">
          <thead><tr><th>Event</th><th>PO</th><th>Result</th><th>Processed at</th></tr></thead>
          <tbody>
            {(events || []).map((e) => (
              <tr key={e.eventId}>
                <td>{e.eventType}</td><td>{e.purchaseOrderId}</td><td><StatusBadge status={e.result} /></td>
                <td>{new Date(e.processedAt).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
