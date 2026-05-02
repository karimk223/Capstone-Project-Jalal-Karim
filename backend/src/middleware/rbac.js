/**
 * Role-based access control middleware. Factory: call `requireRole([...])`
 * with the list of role_name values allowed on this route, and plug the
 * returned middleware in after `auth`.
 *
 * Implements FR-3 and addresses Gap 5 (security-through-menu-visibility).
 * In the legacy system, the UI hid menus but the database would still serve
 * the data to anyone who knew the right query. Here, the server denies the
 * request outright.
 *
 * Usage:
 *   router.post('/', auth, requireRole(['Clerk', 'Director', 'Admin']), ctrl.create);
 */

const ApiError = require('../utils/apiError');

function requireRole(allowedRoles) {
  // Normalize once at setup so we're not doing it per-request.
  const allowed = allowedRoles.map(r => r.toLowerCase());

  return (req, res, next) => {
    // `auth` must have run first and set req.user.
    if (!req.user || !req.user.role_name) {
      return next(new ApiError(401, 'NOT_AUTHENTICATED', 'Authentication required.'));
    }

    if (!allowed.includes(req.user.role_name.toLowerCase())) {
      return next(
        new ApiError(403, 'FORBIDDEN_ROLE', 'You do not have permission to perform this action.')
      );
    }

    next();
  };
}

module.exports = requireRole;
