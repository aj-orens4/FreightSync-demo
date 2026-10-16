const rateLimit = require('express-rate-limit');

// Credential protection without trapping legitimate users. Successful logins do
// not consume the failure budget and the window is short enough for recovery.
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 8,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success:false, message:'Too many failed sign-in attempts. Please wait up to 5 minutes, then try again.' }
});

// Verification-code guesses get their own budget instead of sharing the login
// counter. A new sign-in creates a new challenge with its own 5-guess limit too.
const twoFactorLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 15,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success:false, message:'Too many verification attempts. Please wait up to 5 minutes and sign in again.' }
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success:false, message:'Too many requests. Please slow down.' }
});

module.exports = { loginLimiter, twoFactorLimiter, generalLimiter };
