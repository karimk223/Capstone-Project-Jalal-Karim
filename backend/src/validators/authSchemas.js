/**
 * Joi schemas for the /auth routes.
 * Field constraints derive from schema.sql (coding-conventions.md §4.5):
 *   STAFF.email         VARCHAR(100) NOT NULL   → string().email().max(100).required()
 *   password (plaintext)                       → min length 8 (policy), max 128 (sanity)
 *   STAFF.full_name     VARCHAR(100) NOT NULL   → string().max(100).required()
 *   STAFF.role_id       INT NOT NULL FK → ROLES → integer().valid(1,2,3,4).required()
 */

const Joi = require('joi');

// POST /auth/login
const login = Joi.object({
  email: Joi.string().email().max(100).required(),
  password: Joi.string().min(1).max(128).required(),
});

// POST /admin/staff — used by admin to create new accounts
// (self-registration is not a public route per api-spec.md §1/§6)
const createStaff = Joi.object({
  full_name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().max(100).required(),
  password: Joi.string().min(8).max(128).required(),
  // role_id matches the ROLES seed: 1=Admin, 2=Clerk, 3=Director, 4=Minister
  role_id: Joi.number().integer().valid(1, 2, 3, 4).required(),
});

module.exports = { login, createStaff };
