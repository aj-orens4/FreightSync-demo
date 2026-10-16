const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');
require('dotenv').config();

/** Verifies the JWT and attaches { user_id, username, role } to req.user */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return fail(res, 'Authentication token missing', 401);

  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return fail(res, 'Server authentication configuration is invalid', 500);
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = payload; // { user_id, username, role, provider_id }
    return next();
  } catch (err) {
    return fail(res, 'Invalid or expired token', 401);
  }
}

/** Usage: authorize('ADMIN', 'LOGISTICS_MANAGER') */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 'Not authenticated', 401);
    if (!allowedRoles.includes(req.user.role)) {
      return fail(res, 'You do not have permission to perform this action', 403);
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
