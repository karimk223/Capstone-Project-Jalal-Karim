/**
 * Authentication middleware. Verifies the `Authorization: Bearer <token>`
 * header, decodes the JWT, and attaches the payload to `req.user`.
 *
 * Implements FR-3 and addresses Gap 5: authentication is enforced server-side
 * on every protected route, not just by hiding menus.
 *
 * After this middleware runs, `req.user` has: { staff_id, role_id, role_name, iat, exp }.
 */

const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/apiError');

function auth(req, res, next) {
  const header = req.headers.authorization || '';

  // Expect exactly "Bearer <token>"
  if (!header.startsWith('Bearer ')) {
    return next(new ApiError(401, 'NOT_AUTHENTICATED', 'Authentication required. Please log in.'));
  }

  const token = header.substring('Bearer '.length).trim();
  if (!token) {
    return next(new ApiError(401, 'NOT_AUTHENTICATED', 'Authentication required. Please log in.'));
  }

  try {
    // verifyToken throws TokenExpiredError / JsonWebTokenError on failure;
    // the central errorHandler catches those and maps them to our codes.
    req.user = verifyToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = auth;
