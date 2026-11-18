const BASE = import.meta.env.VITE_API_BASE || '';

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!res.ok) {
    const err = new Error(data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const qs = (params = {}) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return p.length ? `?${new URLSearchParams(p)}` : '';
};

export const api = {
  suppliers: {
    list: (params) => request(`/api/suppliers${qs(params)}`),
    categories: () => request('/api/suppliers/categories'),
    create: (body) => request('/api/suppliers', { method: 'POST', body }),
    update: (id, body) => request(`/api/suppliers/${id}`, { method: 'PUT', body }),
    setStatus: (id, status) => request(`/api/suppliers/${id}/status`, { method: 'PATCH', body: { status } }),
    rate: (id, rating) => request(`/api/suppliers/${id}/ratings`, { method: 'POST', body: { rating } }),
  },
  purchaseOrders: {
    list: (params) => request(`/api/purchase-orders${qs(params)}`),
    create: (body) => request('/api/purchase-orders', { method: 'POST', body }),
    submit: (id) => request(`/api/purchase-orders/${id}/submit`, { method: 'POST' }),
    approve: (id, body) => request(`/api/purchase-orders/${id}/approve`, { method: 'POST', body }),
    reject: (id, body) => request(`/api/purchase-orders/${id}/reject`, { method: 'POST', body }),
    cancel: (id, body) => request(`/api/purchase-orders/${id}/cancel`, { method: 'POST', body }),
    complete: (id) => request(`/api/purchase-orders/${id}/complete`, { method: 'POST' }),
    history: (id) => request(`/api/purchase-orders/${id}/history`),
    circuitBreaker: () => request('/api/purchase-orders/system/circuit-breaker'),
    outbox: () => request('/api/purchase-orders/system/outbox'),
  },
  budgets: {
    list: () => request('/api/budgets'),
    create: (body) => request('/api/budgets', { method: 'POST', body }),
    update: (id, body) => request(`/api/budgets/${id}`, { method: 'PUT', body }),
    alerts: () => request('/api/budgets/alerts'),
    reservations: () => request('/api/reservations'),
  },
  analytics: {
    overview: () => request('/api/analytics/overview'),
    departments: () => request('/api/analytics/departments'),
    categories: () => request('/api/analytics/categories'),
    suppliers: () => request('/api/analytics/suppliers'),
    monthly: () => request('/api/analytics/monthly'),
    anomalies: () => request('/api/analytics/anomalies'),
    events: () => request('/api/analytics/events'),
  },
  health: (service) => request(service ? `/health/${service}` : '/health'),
};

export const inr = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(n || 0));
