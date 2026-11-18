const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const supplierRoutes = require('./routes/supplierRoutes');
const { pool } = require('./db');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('tiny'));

  // Liveness: process is alive (no DB check -> avoids restart loops)
  app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'supplier-service', timestamp: new Date().toISOString() });
  });

  // Readiness: DB reachable
  app.get('/ready', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'READY', service: 'supplier-service' });
    } catch (err) {
      res.status(503).json({ status: 'NOT_READY', error: err.message });
    }
  });

  app.use('/api/suppliers', supplierRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    let status = err.status || 500;
    let message = err.message;
    if (err.code === '23505') { status = 409; message = 'Supplier with same email or GST number already exists'; }
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR', message, details: err.details });
  });

  return app;
}

module.exports = { createApp };
