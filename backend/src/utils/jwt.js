/**
 * JWT helpers. All token signing/verification goes through this file so the
 * algorithm, secret, and expiry stay consistent.
 *
 * Implements coding-conventions.md §4.4:
 *   - Algorithm: HS256
 *   - Secret: process.env.JWT_SECRET (loaded via config/env.js)
 *   - Expiry: 8h
 *   - Payload: { staff_id, role_id, role_name } — never email, never password hash
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Sign a token for a logged-in staff member.
 * @param {{ staff_id: number, role_id: number, role_name: string }} payload
 * @returns {string} signed JWT
 */
function signToken(payload) {
  return jwt.sign(payload, env.auth.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: env.auth.jwtExpiresIn,
  });
}

/**
 * Verify and decode a token. Throws jsonwebtoken's TokenExpiredError or
 * JsonWebTokenError on failure — the auth middleware catches those and
 * converts them to ApiError with the right error code.
 * @param {string} token
 * @returns {object} decoded payload
 */
function verifyToken(token) {
  return jwt.verify(token, env.auth.jwtSecret, { algorithms: ['HS256'] });
}

module.exports = { signToken, verifyToken };
