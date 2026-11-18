const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.db);

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS budgets (
    id               SERIAL PRIMARY KEY,
    department       VARCHAR(100) UNIQUE NOT NULL,
    fiscal_year      VARCHAR(9)   NOT NULL DEFAULT '2026-27',
    allocated_amount NUMERIC(15,2) NOT NULL CHECK (allocated_amount >= 0),
    consumed_amount  NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (consumed_amount >= 0),
    reserved_amount  NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (reserved_amount >= 0),
    alert_threshold  NUMERIC(5,2)  NOT NULL DEFAULT 80,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by       VARCHAR(100),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by       VARCHAR(100),
    CONSTRAINT budget_not_overspent CHECK (consumed_amount + reserved_amount <= allocated_amount)
  );

  CREATE TABLE IF NOT EXISTS budget_reservations (
    id          SERIAL PRIMARY KEY,
    po_id       VARCHAR(40) UNIQUE NOT NULL,
    budget_id   INT NOT NULL REFERENCES budgets(id),
    amount      NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    status      VARCHAR(20) NOT NULL CHECK (status IN ('RESERVED', 'COMMITTED', 'RELEASED')),
    reason      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  VARCHAR(100),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  VARCHAR(100)
  );

  CREATE TABLE IF NOT EXISTS budget_alerts (
    id               SERIAL PRIMARY KEY,
    budget_id        INT NOT NULL REFERENCES budgets(id),
    threshold        NUMERIC(5,2) NOT NULL,
    utilization      NUMERIC(6,2) NOT NULL,
    alert_status     VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    message          TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by       VARCHAR(100)
  );

  -- Idempotent consumer: every processed RabbitMQ event id is stored once.
  CREATE TABLE IF NOT EXISTS processed_events (
    event_id     VARCHAR(64) PRIMARY KEY,
    event_type   VARCHAR(60),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS budget_audit_log (
    id              SERIAL PRIMARY KEY,
    budget_id       INT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    action          VARCHAR(50) NOT NULL,
    old_values      JSONB,
    new_values      JSONB,
    changed_by      VARCHAR(100) NOT NULL,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason          TEXT
  );
`;

async function init() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(31004)');
    await client.query(SCHEMA);
    console.log('Budget database schema initialized. Ready to accept real data.');
  } finally {
    await client.query('SELECT pg_advisory_unlock(31004)').catch(() => {});
    client.release();
  }
}

module.exports = { pool, init };
