const { fail } = require('../utils/response');

/**
 * SECURITY CONTROL: Error Handling
 * Threat: leaking stack traces, SQL error text, or internal file paths to a
 * client, which can hand an attacker a roadmap of the schema/stack.
 * Behavior: full error (incl. stack) is always logged server-side for
 * debugging, but the client only ever receives one of a small set of safe,
 * generic messages — never err.message directly — unless NODE_ENV=development.
 */
function errorHandler(err, req, res, next) {
  console.error('[ERROR]', new Date().toISOString(), req.method, req.originalUrl, err);

  if (err.code === 'ER_DUP_ENTRY') {
    return fail(res, 'A record with this value already exists', 409);
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
    return fail(res, 'This action violates a related-record constraint', 409);
  }

  const isDev = process.env.NODE_ENV === 'development';
  const statusCode = err.statusCode || 500;
  const safeMessage = statusCode >= 500
    ? (isDev ? err.message : 'Something went wrong on our end. Please try again.')
    : (err.message || 'Request could not be processed');

  return fail(res, safeMessage, statusCode);
}

module.exports = errorHandler;
