const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/users.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('ADMIN'));

router.get('/', ctrl.listUsers);
router.get('/providers', ctrl.listProviders);
router.post('/', ctrl.createUser);
router.put('/:id', ctrl.updateUser);
router.post('/:id/reset-password', ctrl.resetPassword);

module.exports = router;
