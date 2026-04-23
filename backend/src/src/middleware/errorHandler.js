/**
 * Central Express error handler. Must be registered LAST in server.js, after
 * all routes. Formats every error into the response shape defined in
 * api-spec.md §9: { error: { code, message } }.
 *
 * Addresses Gap 7: no raw SQL, stack traces, or framework messages reach
 * the client. The full error is logged server-side for the developer.
 */

const ApiError = require('../utils/apiError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Always log server-side so we can debug — never print stacks to the client.
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Our own typed errors already have status + code + message.
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
  }

  // JWT library errors → map to our codes from api-spec.md §9.
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: { code: 'TOKEN_EXPIRED', message: 'Your session has expired. Please log in again.' },
    });
  }
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: { code: 'NOT_AUTHENTICATED', message: 'Invalid authentication token.' },
    });
  }

  // MySQL duplicate-key errors → map to our friendly codes.
  if (err.code === 'ER_DUP_ENTRY') {
    // Best-effort: tell the user which unique key was violated
    if (err.message.includes('uq_staff_email')) {
      return res.status(409).json({
        error: { code: 'DUPLICATE_EMAIL', message: 'An account with this email already exists.' },
      });
    }
    if (err.message.includes('uq_citizen_national_id')) {
      return res.status(409).json({
        error: { code: 'DUPLICATE_NATIONAL_ID', message: 'A citizen with this national ID already exists.' },
      });
    }
    return res.status(409).json({
      error: { code: 'DUPLICATE_ENTRY', message: 'That value is already in use.' },
    });
  }

  // Anything else is unexpected — generic 500.
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' },
  });
}

module.exports = errorHandler;
