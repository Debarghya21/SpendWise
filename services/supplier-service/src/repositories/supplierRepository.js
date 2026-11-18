const { pool } = require('../db');

const SELECT = `
  SELECT s.*, c.category_name,
         COALESCE(r.rating, 0) AS rating, COALESCE(r.review_count, 0) AS review_count
  FROM suppliers s
  LEFT JOIN supplier_categories c ON c.id = s.category_id
  LEFT JOIN supplier_ratings r   ON r.supplier_id = s.id`;

async function findAll({ status, category, search } = {}) {
  const { rows } = await pool.query(
    `${SELECT}
     WHERE ($1::text IS NULL OR s.status = $1)
       AND ($2::text IS NULL OR c.category_name = $2)
       AND ($3::text IS NULL OR s.name ILIKE '%' || $3 || '%')
     ORDER BY s.created_at ASC`,
    [status || null, category || null, search || null],
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(`${SELECT} WHERE s.id = $1`, [id]);
  return rows[0] || null;
}

async function ensureCategory(name, userId = 'system') {
  if (!name) return null;
  const { rows } = await pool.query(
    `INSERT INTO supplier_categories (category_name, created_by, updated_by) VALUES ($1, $2, $3)
     ON CONFLICT (category_name) DO UPDATE SET category_name = EXCLUDED.category_name
     RETURNING id`,
    [name, userId, userId],
  );
  return rows[0].id;
}

async function create(s, userId = 'system') {
  const categoryId = await ensureCategory(s.category, userId);
  const { rows } = await pool.query(
    `INSERT INTO suppliers (name, email, phone, gst_number, category_id, address, status, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [s.name, s.email, s.phone || null, s.gstNumber.toUpperCase(), categoryId, s.address || null, s.status || 'ACTIVE', userId, userId],
  );
  const supplierId = rows[0].id;
  await pool.query('INSERT INTO supplier_ratings (supplier_id, updated_by) VALUES ($1, $2) ON CONFLICT DO NOTHING', [supplierId, userId]);
  
  // Log the creation
  await pool.query(
    `INSERT INTO supplier_audit_log (supplier_id, action, changed_by, reason) VALUES ($1, $2, $3, $4)`,
    [supplierId, 'CREATED', userId, 'New supplier registered'],
  );
  
  return findById(supplierId);
}

async function update(id, s, userId = 'system') {
  const categoryId = s.category !== undefined ? await ensureCategory(s.category, userId) : undefined;
  
  // Get old values for audit
  const oldSupplier = await findById(id);
  if (!oldSupplier) return null;
  
  const oldValues = {
    name: oldSupplier.name,
    email: oldSupplier.email,
    phone: oldSupplier.phone,
    gstNumber: oldSupplier.gst_number,
    address: oldSupplier.address,
  };
  
  const { rowCount } = await pool.query(
    `UPDATE suppliers SET
       name        = COALESCE($2, name),
       email       = COALESCE($3, email),
       phone       = COALESCE($4, phone),
       gst_number  = COALESCE($5, gst_number),
       category_id = COALESCE($6, category_id),
       address     = COALESCE($7, address),
       updated_at  = now(),
       updated_by  = $8
     WHERE id = $1`,
    [id, s.name ?? null, s.email ?? null, s.phone ?? null,
      s.gstNumber ? s.gstNumber.toUpperCase() : null, categoryId ?? null, s.address ?? null, userId],
  );
  
  if (rowCount) {
    const newValues = { name: s.name, email: s.email, phone: s.phone, gstNumber: s.gstNumber, address: s.address };
    await pool.query(
      `INSERT INTO supplier_audit_log (supplier_id, action, old_values, new_values, changed_by, reason) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, 'UPDATED', JSON.stringify(oldValues), JSON.stringify(newValues), userId, 'Supplier details modified'],
    );
  }
  
  return rowCount ? findById(id) : null;
}

async function updateStatus(id, status, userId = 'system') {
  const oldSupplier = await findById(id);
  if (!oldSupplier) return null;
  
  const { rowCount } = await pool.query(
    'UPDATE suppliers SET status = $2, updated_at = now(), updated_by = $3 WHERE id = $1',
    [id, status, userId],
  );
  
  if (rowCount) {
    await pool.query(
      `INSERT INTO supplier_audit_log (supplier_id, action, old_values, new_values, changed_by, reason) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, 'STATUS_CHANGED', JSON.stringify({ status: oldSupplier.status }), JSON.stringify({ status }), userId, `Status changed to ${status}`],
    );
  }
  
  return rowCount ? findById(id) : null;
}

async function addRating(id, rating, userId = 'system') {
  await pool.query(
    `INSERT INTO supplier_ratings (supplier_id, rating, review_count, updated_by) VALUES ($1, $2, 1, $3)
     ON CONFLICT (supplier_id) DO UPDATE SET
       rating = ROUND((supplier_ratings.rating * supplier_ratings.review_count + $2)
                      / (supplier_ratings.review_count + 1), 2),
       review_count = supplier_ratings.review_count + 1,
       updated_at = now(),
       updated_by = $3`,
    [id, rating, userId],
  );
  
  await pool.query(
    `INSERT INTO supplier_audit_log (supplier_id, action, changed_by, reason) VALUES ($1, $2, $3, $4)`,
    [id, 'RATED', userId, `New rating: ${rating}/5`],
  );
  
  return findById(id);
}

async function categories() {
  const { rows } = await pool.query(
    `SELECT c.id, c.category_name, c.description, COUNT(s.id)::int AS supplier_count
     FROM supplier_categories c LEFT JOIN suppliers s ON s.category_id = c.id
     GROUP BY c.id ORDER BY c.category_name`,
  );
  return rows.map((r) => ({
    id: r.id, categoryName: r.category_name, description: r.description, supplierCount: r.supplier_count,
  }));
}

module.exports = { findAll, findById, create, update, updateStatus, addRating, categories };
