const express = require('express');
const router = express.Router();
const { login, verifyTwoFactor, resendTwoFactor, register, me, updateMe, changePassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { loginLimiter, twoFactorLimiter } = require('../middleware/rateLimit');

router.post('/login', loginLimiter, login);
router.post('/verify-2fa', twoFactorLimiter, verifyTwoFactor);
router.post('/resend-2fa', twoFactorLimiter, resendTwoFactor);
// Enterprise FMS accounts are provisioned by an ADMIN so roles/provider scope cannot be self-selected.
router.post('/register', loginLimiter, (req, res) => res.status(403).json({ success: false, message: 'Public registration is disabled. Ask an administrator to create your FreightSync account.' }));
router.get('/me', authenticate, me);
router.patch('/me', authenticate, updateMe);
router.patch('/change-password', authenticate, changePassword);
// Logout is stateless (JWT) - client simply discards the token.
router.post('/logout', authenticate, (req, res) => res.json({ success: true, data: null }));

module.exports = router;
