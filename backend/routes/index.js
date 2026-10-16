const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/routes', require('./routes.routes'));
router.use('/tariffs', require('./tariffs.routes'));
router.use('/sops', require('./sops.routes'));
router.use('/schedules', require('./schedules.routes'));
router.use('/reminders', require('./reminders.routes'));
router.use('/users', require('./users.routes'));
router.use('/audit-logs', require('./auditLogs.routes'));

router.use('/notifications', require('./notifications.routes'));

router.use('/support', require('./support.routes'));

router.use('/reports', require('./reports.routes'));

router.use('/backup', require('./backup.routes'));

module.exports = router;
