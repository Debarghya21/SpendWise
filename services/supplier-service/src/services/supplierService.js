const repo = require('../repositories/supplierRepository');
const { validateSupplier, toSupplierDto, STATUSES } = require('../models/supplier');
const { HttpError } = require('../errors');

async function list(filters) {
  return (await repo.findAll(filters)).map(toSupplierDto);
}

async function get(id) {
  const row = await repo.findById(id);
  if (!row) throw new HttpError(404, `Supplier ${id} not found`);
  return toSupplierDto(row);
}

async function register(body, userId = 'system') {
  const errors = validateSupplier(body);
  if (errors.length) throw new HttpError(400, 'Validation failed', errors);
  return toSupplierDto(await repo.create(body, userId));
}

async function update(id, body, userId = 'system') {
  const errors = validateSupplier(body, { partial: true });
  if (errors.length) throw new HttpError(400, 'Validation failed', errors);
  const row = await repo.update(id, body, userId);
  if (!row) throw new HttpError(404, `Supplier ${id} not found`);
  return toSupplierDto(row);
}

async function changeStatus(id, status, userId = 'system') {
  if (!STATUSES.includes(status)) {
    throw new HttpError(400, `status must be one of ${STATUSES.join(', ')}`);
  }
  const row = await repo.updateStatus(id, status, userId);
  if (!row) throw new HttpError(404, `Supplier ${id} not found`);
  return toSupplierDto(row);
}

/** Eligibility check used synchronously by the Purchase Order Service. */
async function validateEligibility(id) {
  const row = await repo.findById(id);
  if (!row) {
    return { supplierId: id, eligible: false, status: 'NOT_FOUND', reason: 'Supplier not found' };
  }
  const eligible = row.status === 'ACTIVE';
  return {
    supplierId: row.id,
    name: row.name,
    category: row.category_name,
    status: row.status,
    eligible,
    reason: eligible ? 'Supplier is active' : `Supplier status is ${row.status}`,
  };
}

async function rate(id, rating, userId = 'system') {
  const value = Number(rating);
  if (!(value >= 1 && value <= 5)) throw new HttpError(400, 'rating must be between 1 and 5');
  if (!(await repo.findById(id))) throw new HttpError(404, `Supplier ${id} not found`);
  return toSupplierDto(await repo.addRating(id, value, userId));
}

module.exports = {
  list, get, register, update, changeStatus, validateEligibility, rate, categories: repo.categories,
};
