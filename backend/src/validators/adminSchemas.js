/**
 * Joi schemas for /api/v1/admin routes.
 * PATCH /admin/staff/:id — update staff fields.
 *
 * Constraints from schema.sql STAFF table:
 *   full_name VARCHAR(100) NOT NULL
 *   email     VARCHAR(100) NOT NULL UNIQUE
 *   role_id   INT NOT NULL FK → ROLES (1-4)
 *   is_active TINYINT(1) NOT NULL DEFAULT 1
 */

const Joi = require('joi');

const updateStaff = Joi.object({
  full_name: Joi.string().trim().min(2).max(100).optional(),
  email: Joi.string().email().max(100).optional(),
  role_id: Joi.number().integer().valid(1, 2, 3, 4).optional(),
  is_active: Joi.number().integer().valid(0, 1).optional(),
}).min(1);

module.exports = { updateStaff };
