const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tariffs.controller');
const { authenticate, authorize } = require('../middleware/auth');

const MANAGE_ROLES = ['ADMIN', 'LOGISTICS_MANAGER'];

router.use(authenticate);

router.get('/', ctrl.listTariffs);
router.post('/quote', ctrl.quote);
router.get('/:id', ctrl.getTariff);
router.get('/:id/history', ctrl.getHistory);

router.post('/', authorize(...MANAGE_ROLES), ctrl.createTariff);
router.put('/:id', authorize(...MANAGE_ROLES), ctrl.updateTariff);
router.patch('/:id/submit', authorize(...MANAGE_ROLES), ctrl.submit);
router.patch('/:id/approve', authorize(...MANAGE_ROLES), ctrl.approve);
router.patch('/:id/reject', authorize(...MANAGE_ROLES), ctrl.reject);
router.patch('/:id/archive', authorize(...MANAGE_ROLES), ctrl.archive);

module.exports = router;
