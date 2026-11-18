const round2 = (n) => Math.round(n * 100) / 100;

/** Available = Allocated - Consumed - Reserved */
function computeAvailability({ allocated, consumed, reserved }) {
  const available = round2(allocated - consumed - reserved);
  const utilization = allocated > 0 ? round2(((consumed + reserved) / allocated) * 100) : 0;
  return { available, utilization };
}

function toBudgetDto(row) {
  const allocated = Number(row.allocated_amount);
  const consumed = Number(row.consumed_amount);
  const reserved = Number(row.reserved_amount);
  const { available, utilization } = computeAvailability({ allocated, consumed, reserved });
  return {
    id: row.id,
    department: row.department,
    fiscalYear: row.fiscal_year,
    allocatedAmount: allocated,
    consumedAmount: consumed,
    reservedAmount: reserved,
    availableAmount: available,
    utilizationPercent: utilization,
    alertThreshold: Number(row.alert_threshold),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toReservationDto(row) {
  return {
    reservationId: row.id,
    poId: row.po_id,
    budgetId: row.budget_id,
    amount: Number(row.amount),
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateBudget(body, { partial = false } = {}) {
  const errors = [];
  if (!body || typeof body !== 'object') return ['Request body is required'];
  if (!partial && (!body.department || String(body.department).trim().length < 2)) {
    errors.push('department is required');
  }
  if ((!partial || body.allocatedAmount !== undefined) && !(Number(body.allocatedAmount) >= 0)) {
    errors.push('allocatedAmount must be a non-negative number');
  }
  if (body.alertThreshold !== undefined) {
    const t = Number(body.alertThreshold);
    if (!(t > 0 && t <= 100)) errors.push('alertThreshold must be between 1 and 100');
  }
  return errors;
}

function validateReservation(body) {
  const errors = [];
  if (!body || !body.poId) errors.push('poId is required');
  if (!body || !(Number(body.amount) > 0)) errors.push('amount must be greater than 0');
  return errors;
}

module.exports = {
  computeAvailability, toBudgetDto, toReservationDto, validateBudget, validateReservation, round2,
};
