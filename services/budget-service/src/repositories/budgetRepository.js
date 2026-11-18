const { pool } = require('../db');

const isNumericId = (v) => /^\d+$/.test(String(v));

/** Resolve a budget by numeric id OR department name (case-insensitive). */
async function find(idOrDepartment, client = pool, { forUpdate = false } = {}) {
  const where = isNumericId(idOrDepartment) ? 'id = $1' : 'LOWER(department) = LOWER($1)';
  const { rows } = await client.query(
    `SELECT * FROM budgets WHERE ${where}${forUpdate ? ' FOR UPDATE' : ''}`,
    [idOrDepartment],
  );
  return rows[0] || null;
}

async function findAll() {
  const { rows } = await pool.query('SELECT * FROM budgets ORDER BY department');
  return rows;
}

async function create({ department, fiscalYear, allocatedAmount, alertThreshold }, userId = 'system') {
  const { rows } = await pool.query(
    `INSERT INTO budgets (department, fiscal_year, allocated_amount, alert_threshold, created_by, updated_by)
     VALUES ($1, COALESCE($2, '2026-27'), $3, COALESCE($4, 80), $5, $6) RETURNING *`,
    [department.trim(), fiscalYear || null, allocatedAmount, alertThreshold ?? null, userId, userId],
  );
  
  const budgetId = rows[0].id;
  await pool.query(
    `INSERT INTO budget_audit_log (budget_id, action, changed_by, reason) VALUES ($1, $2, $3, $4)`,
    [budgetId, 'CREATED', userId, 'New budget allocation'],
  );
  
  return rows[0];
}

async function update(id, { allocatedAmount, alertThreshold, fiscalYear }, userId = 'system') {
  const oldBudget = await find(id);
  if (!oldBudget) return null;
  
  const oldValues = { allocatedAmount: oldBudget.allocated_amount, alertThreshold: oldBudget.alert_threshold };
  
  const { rows } = await pool.query(
    `UPDATE budgets SET
       allocated_amount = COALESCE($2, allocated_amount),
       alert_threshold  = COALESCE($3, alert_threshold),
       fiscal_year      = COALESCE($4, fiscal_year),
       updated_at = now(),
       updated_by = $5
     WHERE id = $1 RETURNING *`,
    [id, allocatedAmount ?? null, alertThreshold ?? null, fiscalYear ?? null, userId],
  );
  
  if (rows.length) {
    const newValues = { allocatedAmount, alertThreshold };
    await pool.query(
      `INSERT INTO budget_audit_log (budget_id, action, old_values, new_values, changed_by, reason) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, 'UPDATED', JSON.stringify(oldValues), JSON.stringify(newValues), userId, 'Budget parameters modified'],
    );
  }
  
  return rows[0] || null;
}

async function adjustAmounts(client, budgetId, { reservedDelta = 0, consumedDelta = 0 }) {
  const { rows } = await client.query(
    `UPDATE budgets SET reserved_amount = reserved_amount + $2,
                        consumed_amount = consumed_amount + $3,
                        updated_at = now()
     WHERE id = $1 RETURNING *`,
    [budgetId, reservedDelta, consumedDelta],
  );
  return rows[0];
}

async function findReservationByPo(client, poId, { forUpdate = false } = {}) {
  const { rows } = await client.query(
    `SELECT * FROM budget_reservations WHERE po_id = $1${forUpdate ? ' FOR UPDATE' : ''}`,
    [poId],
  );
  return rows[0] || null;
}

async function findReservationById(client, id, { forUpdate = false } = {}) {
  const { rows } = await client.query(
    `SELECT * FROM budget_reservations WHERE id = $1${forUpdate ? ' FOR UPDATE' : ''}`,
    [id],
  );
  return rows[0] || null;
}

async function upsertReservation(client, { poId, budgetId, amount }, userId = 'system') {
  const { rows } = await client.query(
    `INSERT INTO budget_reservations (po_id, budget_id, amount, status, created_by, updated_by)
     VALUES ($1, $2, $3, 'RESERVED', $4, $5)
     ON CONFLICT (po_id) DO UPDATE SET budget_id = EXCLUDED.budget_id, amount = EXCLUDED.amount,
       status = 'RESERVED', reason = NULL, updated_at = now(), updated_by = $5
     RETURNING *`,
    [poId, budgetId, amount, userId, userId],
  );
  return rows[0];
}

async function setReservationStatus(client, id, status, reason, userId = 'system') {
  const { rows } = await client.query(
    `UPDATE budget_reservations SET status = $2, reason = $3, updated_at = now(), updated_by = $4 WHERE id = $1 RETURNING *`,
    [id, status, reason || null, userId],
  );
  return rows[0];
}

async function listReservations({ poId, budgetId } = {}) {
  const { rows } = await pool.query(
    `SELECT * FROM budget_reservations
     WHERE ($1::text IS NULL OR po_id = $1) AND ($2::int IS NULL OR budget_id = $2)
     ORDER BY created_at DESC LIMIT 200`,
    [poId || null, budgetId || null],
  );
  return rows;
}

async function openAlertExists(client, budgetId, threshold) {
  const { rows } = await client.query(
    `SELECT 1 FROM budget_alerts WHERE budget_id = $1 AND threshold = $2 AND alert_status = 'OPEN'`,
    [budgetId, threshold],
  );
  return rows.length > 0;
}

async function createAlert(client, { budgetId, threshold, utilization, message }, userId = 'system') {
  const { rows } = await client.query(
    `INSERT INTO budget_alerts (budget_id, threshold, utilization, message, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [budgetId, threshold, utilization, message, userId],
  );
  return rows[0];
}

async function listAlerts() {
  const { rows } = await pool.query(
    `SELECT a.*, b.department FROM budget_alerts a JOIN budgets b ON b.id = a.budget_id
     ORDER BY a.created_at DESC LIMIT 100`,
  );
  return rows.map((r) => ({
    id: r.id,
    budgetId: r.budget_id,
    department: r.department,
    threshold: Number(r.threshold),
    utilization: Number(r.utilization),
    alertStatus: r.alert_status,
    message: r.message,
    createdAt: r.created_at,
  }));
}

/** Returns true if this is the first time the event is seen (inside the caller's transaction). */
async function markEventProcessed(client, eventId, eventType) {
  const { rowCount } = await client.query(
    'INSERT INTO processed_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [eventId, eventType],
  );
  return rowCount === 1;
}

module.exports = {
  find, findAll, create, update, adjustAmounts,
  findReservationByPo, findReservationById, upsertReservation, setReservationStatus, listReservations,
  openAlertExists, createAlert, listAlerts, markEventProcessed,
};
