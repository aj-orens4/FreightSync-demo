const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sops.controller');
const { authenticate, authorize } = require('../middleware/auth');

const AUTHOR_ROLES = ['ADMIN', 'LOGISTICS_MANAGER', 'ROUTE_PLANNER'];
const APPROVER_ROLES = ['ADMIN', 'LOGISTICS_MANAGER'];

router.use(authenticate);

router.get('/', ctrl.listSops);
router.get('/:id', ctrl.getSop);
router.get('/:id/versions', ctrl.getVersions);

router.post('/', authorize(...AUTHOR_ROLES), ctrl.createSop);
router.put('/:id', authorize(...AUTHOR_ROLES), ctrl.updateSop);
router.post('/:id/documents', authorize(...AUTHOR_ROLES), ctrl.attachDocument);

router.patch('/:id/submit', authorize(...AUTHOR_ROLES), ctrl.submit);
router.patch('/:id/approve', authorize(...APPROVER_ROLES), ctrl.approve);
router.patch('/:id/reject', authorize(...APPROVER_ROLES), ctrl.reject);
router.patch('/:id/publish', authorize(...APPROVER_ROLES), ctrl.publish);
router.patch('/:id/archive', authorize(...APPROVER_ROLES), ctrl.archive);

module.exports = router;
