/**
 * Unit tests for RBAC middleware.
 * Implements NFR-6 (test coverage). Verifies FR-3 + Gap 5 (server-side RBAC).
 */

const requireRole = require('../../src/middleware/rbac');

describe('RBAC middleware', () => {
  // Helper: create a fake req/res/next for each test
  function setup(user) {
    const req = { user };
    const res = {};
    const next = jest.fn();
    return { req, res, next };
  }

  test('allows access when user role is in the allowed list', () => {
    const middleware = requireRole(['Director', 'Admin']);
    const { req, res, next } = setup({ role_name: 'Director' });

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(); // called with no error
  });

  test('denies access when user role is NOT in the allowed list', () => {
    const middleware = requireRole(['Admin']);
    const { req, res, next } = setup({ role_name: 'Clerk' });

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN_ROLE');
  });

  test('returns 401 when req.user is missing (no auth ran)', () => {
    const middleware = requireRole(['Admin']);
    const { req, res, next } = setup(undefined);

    middleware(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.code).toBe('NOT_AUTHENTICATED');
  });

  test('role check is case-insensitive', () => {
    const middleware = requireRole(['admin']);
    const { req, res, next } = setup({ role_name: 'Admin' });

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('Admin role passes when listed', () => {
    const middleware = requireRole(['Admin']);
    const { req, res, next } = setup({ role_name: 'Admin' });

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
