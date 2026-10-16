const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/auditLogs.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('ADMIN'));
router.get('/', ctrl.listLogs);
router.patch('/:id/archive', ctrl.setArchived);

module.exports = router;
