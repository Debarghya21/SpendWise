const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { budgets, reservations } = require('./routes/budgetRoutes');
const { pool } = require('./db');
const messaging = require('./messaging/rabbit');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('tiny'));

  app.get('/health', (req, res) => {
    res.json({
      status: 'UP',
      service: 'budget-service',
      messaging: { connected: messaging.state.connected, consumed: messaging.state.consumed },
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'READY', service: 'budget-service' });
    } catch (err) {
      res.status(503).json({ status: 'NOT_READY', error: err.message });
    }
  });

  app.use('/api/budgets', budgets);
  app.use('/api/reservations', reservations);

  app.use((req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    let status = err.status || 500;
    let message = err.message;
    if (err.code === '23505') { status = 409; message = 'A budget for this department already exists'; }
    if (err.code === '23514') { status = 409; message = 'Operation would overspend the budget'; }
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR', message, details: err.details });
  });

  return app;
}

module.exports = { createApp };
