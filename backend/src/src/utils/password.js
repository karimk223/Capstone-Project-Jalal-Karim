/**
 * Password hashing helpers. All bcrypt calls go through this file so the cost
 * factor is centrally configured (coding-conventions.md §4.3).
 */

const bcrypt = require('bcrypt');
const env = require('../config/env');

/**
 * Hash a plaintext password for storage in STAFF.password_hash.
 * @param {string} plaintext
 * @returns {Promise<string>} bcrypt hash
 */
function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, env.auth.bcryptCost);
}

/**
 * Compare a plaintext login attempt against a stored bcrypt hash.
 * @param {string} plaintext
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

module.exports = { hashPassword, verifyPassword };
