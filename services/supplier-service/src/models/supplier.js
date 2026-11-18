const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING_VERIFICATION', 'BLOCKED'];

/**
 * Validates a supplier payload. Returns an array of error messages (empty = valid).
 * @param {object} body
 * @param {{partial?: boolean}} opts partial=true for updates (only validate provided fields)
 */
function validateSupplier(body, { partial = false } = {}) {
  const errors = [];
  if (!body || typeof body !== 'object') return ['Request body is required'];

  const need = (field) => !partial || body[field] !== undefined;

  if (need('name') && (!body.name || String(body.name).trim().length < 2)) {
    errors.push('name is required (min 2 characters)');
  }
  if (need('email') && !EMAIL_REGEX.test(String(body.email || ''))) {
    errors.push('email must be a valid email address');
  }
  if (need('gstNumber') && !GST_REGEX.test(String(body.gstNumber || '').toUpperCase())) {
    errors.push('gstNumber must be a valid 15-character GSTIN (e.g. 29ABCDE1234F1Z5)');
  }
  if (body.status !== undefined && !STATUSES.includes(body.status)) {
    errors.push(`status must be one of ${STATUSES.join(', ')}`);
  }
  return errors;
}

function toSupplierDto(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    gstNumber: row.gst_number,
    category: row.category_name || null,
    address: row.address,
    status: row.status,
    rating: Number(row.rating || 0),
    reviewCount: Number(row.review_count || 0),
    // Audit fields
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    lastVerifiedAt: row.last_verified_at,
    verificationStatus: row.verification_status,
  };
}

module.exports = { validateSupplier, toSupplierDto, STATUSES, GST_REGEX };
