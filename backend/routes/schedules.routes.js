const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/schedules.controller');
const { authenticate, authorize } = require('../middleware/auth');

const MANAGE_ROLES = ['ADMIN', 'LOGISTICS_MANAGER', 'ROUTE_PLANNER'];
const STATUS_ROLES = ['ADMIN', 'LOGISTICS_MANAGER', 'OPERATIONS_COORDINATOR'];
const DELAY_ROLES = ['ADMIN', 'LOGISTICS_MANAGER', 'OPERATIONS_COORDINATOR', 'SERVICE_PROVIDER_ADMIN'];

router.use(authenticate);

// NOTE: /calendar must be registered before /:id to avoid being captured as an id param
router.get('/calendar', ctrl.calendarView);
router.get('/', ctrl.listSchedules);
router.get('/:id', ctrl.getSchedule);

router.post('/', authorize(...MANAGE_ROLES), ctrl.createSchedule);
router.put('/:id', authorize(...MANAGE_ROLES), ctrl.updateSchedule);
router.patch('/:id/status', authorize(...STATUS_ROLES), ctrl.updateStatus);
router.post('/:id/delay', authorize(...DELAY_ROLES), ctrl.logDelay);

module.exports = router;
