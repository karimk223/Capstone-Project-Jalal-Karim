/**
 * Central Express error handler. Must be registered LAST in server.js, after
 * all routes. Formats every error into:
 * { error: { code, message } }
 */

const ApiError = require('../utils/apiError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err.message);

  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Your session has expired. Please log in again.',
      },
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: {
        code: 'NOT_AUTHENTICATED',
        message: 'Invalid authentication token.',
      },
    });
  }

  if (err.code === 'ER_DUP_ENTRY') {
    if (err.message.includes('uq_staff_email')) {
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_EMAIL',
          message: 'An account with this email already exists.',
        },
      });
    }

    if (err.message.includes('uq_citizen_national_id')) {
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_NATIONAL_ID',
          message: 'A citizen with this national ID already exists.',
        },
      });
    }

    if (err.message.includes('uq_complaints_file_number')) {
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_FILE_NUMBER',
          message: 'A complaint with this file number already exists.',
        },
      });
    }

    return res.status(409).json({
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'That value is already in use.',
      },
    });
  }

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
    },
  });
}

module.exports = errorHandler;