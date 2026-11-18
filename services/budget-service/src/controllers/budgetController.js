const service = require('../services/budgetService');

module.exports = {
  list: async (req, res) => res.json(await service.list()),
  alerts: async (req, res) => res.json(await service.listAlerts()),
  get: async (req, res) => res.json(await service.get(req.params.id)),
  create: async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id || 'anonymous';
    res.status(201).json(await service.create(req.body, userId));
  },
  update: async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id || 'anonymous';
    res.json(await service.update(req.params.id, req.body, userId));
  },
  availability: async (req, res) => res.json(await service.availability(req.params.id)),
  reserve: async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id || 'anonymous';
    const r = await service.reserve(req.params.id, req.body, userId);
    res.status(r.idempotent ? 200 : 201).json(r);
  },
  listReservations: async (req, res) => {
    res.json(await service.listReservations({ poId: req.query.poId, budgetId: req.query.budgetId }));
  },
  release: async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id || 'anonymous';
    res.json(await service.releaseById(req.params.id, req.body?.reason, userId));
  },
};
