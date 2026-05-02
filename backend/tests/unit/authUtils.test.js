/**
 * Unit tests for JWT helpers and ApiError class.
 * Implements NFR-1 (security primitives are correct).
 */

// Stub the env so we don't need a real .env loaded
jest.mock('../../src/config/env', () => ({
  auth: {
    jwtSecret: 'test-secret-for-jest',
    jwtExpiresIn: '1h',
  },
}));

const { signToken, verifyToken } = require('../../src/utils/jwt');
const ApiError = require('../../src/utils/apiError');
const jwt = require('jsonwebtoken');

describe('JWT helpers', () => {
  test('signToken returns a string', () => {
    const token = signToken({ staff_id: 1, role_id: 3, role_name: 'Director' });
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // header.payload.signature
  });

  test('verifyToken returns the original payload', () => {
    const payload = { staff_id: 42, role_id: 2, role_name: 'Clerk' };
    const token = signToken(payload);
    const decoded = verifyToken(token);

    expect(decoded.staff_id).toBe(42);
    expect(decoded.role_id).toBe(2);
    expect(decoded.role_name).toBe('Clerk');
  });

  test('verifyToken throws on a tampered token', () => {
    const token = signToken({ staff_id: 1, role_id: 1, role_name: 'Admin' });
    const tampered = token.slice(0, -2) + 'XX';

    expect(() => verifyToken(tampered)).toThrow();
  });

  test('verifyToken throws on a token signed with a different secret', () => {
    const evil = jwt.sign({ staff_id: 999 }, 'wrong-secret', { algorithm: 'HS256' });
    expect(() => verifyToken(evil)).toThrow();
  });
});

describe('ApiError', () => {
  test('stores status, code, and message', () => {
    const err = new ApiError(404, 'NOT_FOUND', 'Complaint not found.');
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Complaint not found.');
  });

  test('is an instance of Error', () => {
    const err = new ApiError(400, 'VALIDATION_FAILED', 'Bad input.');
    expect(err).toBeInstanceOf(Error);
  });
});
