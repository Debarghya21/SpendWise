const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.db);

const SCHEMA = `
  CREATE SEQUENCE IF NOT EXISTS supplier_seq START 101;

  CREATE TABLE IF NOT EXISTS supplier_categories (
    id            SERIAL PRIMARY KEY,
    category_name VARCHAR(100) UNIQUE NOT NULL,
    description   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by    VARCHAR(100),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by    VARCHAR(100)
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id                  VARCHAR(20) PRIMARY KEY DEFAULT ('SUP-' || nextval('supplier_seq')),
    name                VARCHAR(200) NOT NULL,
    email               VARCHAR(200) UNIQUE NOT NULL,
    phone               VARCHAR(30),
    gst_number          VARCHAR(15) UNIQUE NOT NULL,
    category_id         INT REFERENCES supplier_categories(id),
    address             TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING_VERIFICATION', 'BLOCKED')),
    verification_status VARCHAR(30) DEFAULT 'UNVERIFIED'
                        CHECK (verification_status IN ('UNVERIFIED', 'VERIFIED', 'REJECTED')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          VARCHAR(100),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by          VARCHAR(100),
    last_verified_at    TIMESTAMPTZ,
    verified_by         VARCHAR(100)
  );

  CREATE TABLE IF NOT EXISTS supplier_ratings (
    id           SERIAL PRIMARY KEY,
    supplier_id  VARCHAR(20) UNIQUE NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    rating       NUMERIC(3,2) NOT NULL DEFAULT 0,
    review_count INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by   VARCHAR(100)
  );

  CREATE TABLE IF NOT EXISTS supplier_audit_log (
    id              SERIAL PRIMARY KEY,
    supplier_id     VARCHAR(20) NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    action          VARCHAR(50) NOT NULL,
    old_values      JSONB,
    new_values      JSONB,
    changed_by      VARCHAR(100) NOT NULL,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason          TEXT
  );
`;

const CATEGORIES = [
  ['IT Equipment', 'Laptops, servers, networking hardware'],
  ['Office Supplies', 'Stationery and consumables'],
  ['Software & Cloud', 'Licences and cloud subscriptions'],
  ['Logistics', 'Freight and courier services'],
  ['Facilities', 'Maintenance and facility management'],
  ['Professional Services', 'Consulting and contractors'],
];

async function init() {
  const client = await pool.connect();
  try {
    // Advisory lock: safe when several replicas start at the same time.
    await client.query('SELECT pg_advisory_lock(31001)');
    await client.query(SCHEMA);
    for (const [name, desc] of CATEGORIES) {
      await client.query(
        'INSERT INTO supplier_categories (category_name, description, created_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [name, desc, 'system'],
      );
    }
    console.log('Supplier database schema initialized. Ready to accept real data.');
  } finally {
    await client.query('SELECT pg_advisory_unlock(31001)').catch(() => {});
    client.release();
  }
}

module.exports = { pool, init };
