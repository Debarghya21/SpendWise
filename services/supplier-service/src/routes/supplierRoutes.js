const { Router } = require('express');
const c = require('../controllers/supplierController');
const { asyncHandler: h } = require('../errors');

const router = Router();

router.get('/', h(c.list));
router.post('/', h(c.create));
router.get('/categories', h(c.categories));
router.get('/:id', h(c.get));
router.put('/:id', h(c.update));
router.patch('/:id/status', h(c.changeStatus));
router.get('/:id/validate', h(c.validate));
router.post('/:id/ratings', h(c.rate));

module.exports = router;
