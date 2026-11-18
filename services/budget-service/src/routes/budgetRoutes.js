const { Router } = require('express');
const c = require('../controllers/budgetController');
const { asyncHandler: h } = require('../errors');

const budgets = Router();
budgets.get('/', h(c.list));
budgets.post('/', h(c.create));
budgets.get('/alerts', h(c.alerts));
budgets.get('/:id', h(c.get));
budgets.put('/:id', h(c.update));
budgets.get('/:id/availability', h(c.availability));
budgets.post('/:id/reservations', h(c.reserve));

const reservations = Router();
reservations.get('/', h(c.listReservations));
reservations.post('/:id/release', h(c.release));

module.exports = { budgets, reservations };
