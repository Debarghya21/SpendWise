const crypto = require('crypto');
const { pool } = require('../db');
const repo = require('../repositories/budgetRepository');
const messaging = require('../messaging/rabbit');
const {
  toBudgetDto, toReservationDto, validateBudget, validateReservation, computeAvailability,
} = require('../models/budget');
const { HttpError } = require('../errors');

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function list() {
  return (await repo.findAll()).map(toBudgetDto);
}

async function get(idOrDept) {
  const row = await repo.find(idOrDept);
  if (!row) throw new HttpError(404, `Budget ${idOrDept} not found`);
  return toBudgetDto(row);
}

async function create(body, userId = 'system') {
  const errors = validateBudget(body);
  if (errors.length) throw new HttpError(400, 'Validation failed', errors);
  return toBudgetDto(await repo.create({ ...body, allocatedAmount: Number(body.allocatedAmount) }, userId));
}

async function update(idOrDept, body, userId = 'system') {
  const errors = validateBudget(body, { partial: true });
  if (errors.length) throw new HttpError(400, 'Validation failed', errors);
  const existing = await repo.find(idOrDept);
  if (!existing) throw new HttpError(404, `Budget ${idOrDept} not found`);
  return toBudgetDto(await repo.update(existing.id, body, userId));
}

async function availability(idOrDept) {
  const b = await get(idOrDept);
  return {
    budgetId: b.id,
    department: b.department,
    allocatedAmount: b.allocatedAmount,
    consumedAmount: b.consumedAmount,
    reservedAmount: b.reservedAmount,
    availableAmount: b.availableAmount,
    utilizationPercent: b.utilizationPercent,
  };
}

/**
 * Atomically reserve funds for a purchase order.
 * SELECT ... FOR UPDATE serialises concurrent reservations on the same budget,
 * so two POs can never spend the same available amount.
 * Idempotent per poId.
 */
async function reserve(idOrDept, body, userId = 'system') {
  const errors = validateReservation(body);
  if (errors.length) throw new HttpError(400, 'Validation failed', errors);
  const amount = Number(body.amount);
  const poId = String(body.poId);

  const result = await withTransaction(async (client) => {
    const budget = await repo.find(idOrDept, client, { forUpdate: true });
    if (!budget) throw new HttpError(404, `No budget found for ${idOrDept}`);

    const existing = await repo.findReservationByPo(client, poId, { forUpdate: true });
    if (existing && existing.status !== 'RELEASED') {
      return { reservation: existing, budget, idempotent: true };
    }

    const { available } = computeAvailability({
      allocated: Number(budget.allocated_amount),
      consumed: Number(budget.consumed_amount),
      reserved: Number(budget.reserved_amount),
    });
    if (amount > available) {
      throw new HttpError(409, `Insufficient budget for ${budget.department}: requested ${amount}, available ${available}`, {
        availableAmount: available, requestedAmount: amount,
      });
    }

    const reservation = await repo.upsertReservation(client, { poId, budgetId: budget.id, amount }, userId);
    const updated = await repo.adjustAmounts(client, budget.id, { reservedDelta: amount });
    const alert = await evaluateThreshold(client, updated, userId);
    return { reservation, budget: updated, idempotent: false, alert };
  });

  if (result.alert) publishAlert(result.alert, result.budget);

  const dto = toBudgetDto(result.budget);
  return {
    ...toReservationDto(result.reservation),
    department: dto.department,
    availableAmount: dto.availableAmount,
    idempotent: result.idempotent,
  };
}

async function evaluateThreshold(client, budgetRow, userId = 'system') {
  const b = toBudgetDto(budgetRow);
  if (b.utilizationPercent < b.alertThreshold) return null;
  if (await repo.openAlertExists(client, b.id, b.alertThreshold)) return null;
  return repo.createAlert(client, {
    budgetId: b.id,
    threshold: b.alertThreshold,
    utilization: b.utilizationPercent,
    message: `${b.department} budget utilisation reached ${b.utilizationPercent}% (threshold ${b.alertThreshold}%)`,
  }, userId);
}

function publishAlert(alert, budgetRow) {
  const b = toBudgetDto(budgetRow);
  messaging.publish('budget.threshold-alert', {
    eventId: crypto.randomUUID(),
    eventType: 'BudgetThresholdAlert',
    occurredAt: new Date().toISOString(),
    alertId: alert.id,
    budgetId: b.id,
    department: b.department,
    threshold: Number(alert.threshold),
    utilization: Number(alert.utilization),
    allocatedAmount: b.allocatedAmount,
    availableAmount: b.availableAmount,
    message: alert.message,
  });
}

/** RESERVED -> RELEASED, returns funds to the budget. */
async function releaseReservation(client, reservation, reason, userId = 'system') {
  if (reservation.status !== 'RESERVED') return reservation; // idempotent no-op
  await repo.adjustAmounts(client, reservation.budget_id, { reservedDelta: -Number(reservation.amount) });
  return repo.setReservationStatus(client, reservation.id, 'RELEASED', reason, userId);
}

/** RESERVED -> COMMITTED, moves reserved funds into consumed. */
async function commitReservation(client, reservation, userId = 'system') {
  if (reservation.status !== 'RESERVED') return reservation;
  const amt = Number(reservation.amount);
  await repo.adjustAmounts(client, reservation.budget_id, { reservedDelta: -amt, consumedDelta: amt });
  return repo.setReservationStatus(client, reservation.id, 'COMMITTED', 'Purchase order approved', userId);
}

async function releaseById(id, reason = 'Released via API', userId = 'system') {
  const row = await withTransaction(async (client) => {
    const r = await repo.findReservationById(client, id, { forUpdate: true });
    if (!r) throw new HttpError(404, `Reservation ${id} not found`);
    if (r.status === 'COMMITTED') throw new HttpError(409, 'Committed reservations cannot be released');
    return releaseReservation(client, r, reason, userId);
  });
  return toReservationDto(row);
}

async function listReservations(filters) {
  return (await repo.listReservations(filters)).map(toReservationDto);
}

/** Handles PO events from RabbitMQ (idempotent: event ids stored in processed_events). */
async function handlePurchaseOrderEvent(event, userId = 'system') {
  if (!event?.eventId || !event?.purchaseOrderId) throw new Error('Invalid event payload');
  return withTransaction(async (client) => {
    const firstTime = await repo.markEventProcessed(client, event.eventId, event.eventType);
    if (!firstTime) return 'duplicate';

    const reservation = await repo.findReservationByPo(client, event.purchaseOrderId, { forUpdate: true });
    if (!reservation) return 'no-reservation';

    // Lock the budget row before modifying amounts.
    await repo.find(reservation.budget_id, client, { forUpdate: true });

    switch (event.eventType) {
      case 'PurchaseOrderApproved':
        await commitReservation(client, reservation, userId);
        return 'committed';
      case 'PurchaseOrderRejected':
      case 'PurchaseOrderCancelled':
        await releaseReservation(client, reservation, `${event.eventType}: ${event.reason || ''}`.trim(), userId);
        return 'released';
      default:
        return 'ignored';
    }
  });
}

module.exports = {
  list, get, create, update, availability, reserve, releaseById, listReservations,
  listAlerts: repo.listAlerts, handlePurchaseOrderEvent,
};
