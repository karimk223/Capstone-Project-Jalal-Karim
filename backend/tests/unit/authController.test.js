/**
 * Unit tests for the auth controller — login flow.
 * Verifies FR-1 (bcrypt password check), FR-2 (JWT issued),
 * FR-4 (disabled accounts blocked).
 */

jest.mock('../../src/config/db', () => ({ execute: jest.fn() }));
jest.mock('../../src/utils/password', () => ({
  verifyPassword: jest.fn(),
  hashPassword:   jest.fn(),
}));
jest.mock('../../src/utils/jwt', () => ({
  signToken: jest.fn(() => 'fake.jwt.token'),
}));

const db        = require('../../src/config/db');
const password  = require('../../src/utils/password');
const jwtUtils  = require('../../src/utils/jwt');
const authCtrl  = require('../../src/controllers/authController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authController.login', () => {
  test('returns 401 when no user with that email exists', async () => {
    db.execute.mockResolvedValueOnce([[]]);
    const next = jest.fn();
    const req  = { body: { email: 'nope@x.com', password: 'whatever' } };

    await authCtrl.login(req, mockRes(), next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.code).toBe('INVALID_CREDENTIALS');
  });

  test('returns 403 when account is disabled (FR-4)', async () => {
    db.execute.mockResolvedValueOnce([[{
      staff_id: 1, full_name: 'Disabled User', email: 'd@x.com',
      password_hash: '$2b$10$hash', is_active: 0,
      role_id: 2, role_name: 'Clerk',
    }]]);
    const next = jest.fn();
    const req  = { body: { email: 'd@x.com', password: 'pw' } };

    await authCtrl.login(req, mockRes(), next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN_ROLE');
  });

  test('returns 401 when password does not match (bcrypt fails)', async () => {
    db.execute.mockResolvedValueOnce([[{
      staff_id: 1, full_name: 'X', email: 'x@x.com',
      password_hash: '$2b$10$hash', is_active: 1,
      role_id: 2, role_name: 'Clerk',
    }]]);
    password.verifyPassword.mockResolvedValueOnce(false);
    const next = jest.fn();
    const req  = { body: { email: 'x@x.com', password: 'wrong' } };

    await authCtrl.login(req, mockRes(), next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.code).toBe('INVALID_CREDENTIALS');
  });

  test('successful login signs a JWT with staff_id, role_id, role_name (FR-2)', async () => {
    db.execute.mockResolvedValueOnce([[{
      staff_id: 7, full_name: 'Director D', email: 'd@x.com',
      password_hash: '$2b$10$hash', is_active: 1,
      role_id: 3, role_name: 'Director',
    }]]);
    password.verifyPassword.mockResolvedValueOnce(true);
    const next = jest.fn();
    const res  = mockRes();
    const req  = { body: { email: 'd@x.com', password: 'correct' } };

    await authCtrl.login(req, res, next);

    expect(jwtUtils.signToken).toHaveBeenCalledWith({
      staff_id: 7, role_id: 3, role_name: 'Director',
    });
    expect(next).not.toHaveBeenCalled(); // no error path
  });
});
