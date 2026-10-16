const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/routes.controller');
const { authenticate, authorize } = require('../middleware/auth');

const MANAGE_ROLES = ['ADMIN', 'LOGISTICS_MANAGER', 'ROUTE_PLANNER'];

router.use(authenticate);

router.get('/', ctrl.listRoutes);
router.get('/:id', ctrl.getRoute);
router.get('/:id/performance', ctrl.routePerformance);
router.get('/:id/optimization', authorize(...MANAGE_ROLES), ctrl.routeOptimization);

router.post('/', authorize(...MANAGE_ROLES), ctrl.createRoute);
router.put('/:id', authorize(...MANAGE_ROLES), ctrl.updateRoute);
router.patch('/:id/status', authorize('ADMIN', 'LOGISTICS_MANAGER'), ctrl.updateRouteStatus);
router.delete('/:id', authorize('ADMIN', 'LOGISTICS_MANAGER'), ctrl.deleteRoute);

module.exports = router;
