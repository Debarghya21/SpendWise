const service = require('../services/supplierService');

module.exports = {
  list: async (req, res) => {
    const { status, category, search } = req.query;
    res.json(await service.list({ status, category, search }));
  },
  categories: async (req, res) => res.json(await service.categories()),
  get: async (req, res) => res.json(await service.get(req.params.id)),
  create: async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id || 'anonymous';
    res.status(201).json(await service.register(req.body, userId));
  },
  update: async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id || 'anonymous';
    res.json(await service.update(req.params.id, req.body, userId));
  },
  changeStatus: async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id || 'anonymous';
    res.json(await service.changeStatus(req.params.id, req.body?.status, userId));
  },
  validate: async (req, res) => {
    const result = await service.validateEligibility(req.params.id);
    res.status(result.status === 'NOT_FOUND' ? 404 : 200).json(result);
  },
  rate: async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id || 'anonymous';
    res.json(await service.rate(req.params.id, req.body?.rating, userId));
  },
};
