const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reminders.controller');
const { authenticate } = require('../middleware/auth');

// No role restriction — every authenticated user manages their own reminders.
// (Authorization is enforced at the query level in the controller: every
// SELECT/UPDATE/DELETE is scoped by `user_id = req.user.user_id`.)
router.use(authenticate);

router.get('/', ctrl.listReminders);
router.post('/', ctrl.createReminder);
router.put('/:id', ctrl.updateReminder);
router.delete('/:id', ctrl.deleteReminder);

module.exports = router;
