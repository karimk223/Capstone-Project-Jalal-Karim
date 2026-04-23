/**
 * Joi schemas for /api/v1/approvals routes.
 * Implements NFR-2: field constraints derived from schema.sql.
 *
 * APPROVALS table columns:
 *   action   ENUM('submitted','approved','rejected','returned') NOT NULL
 *   comment  TEXT NULL
 */

const Joi = require('joi');

// POST /approvals/:id/approve
const approveSchema = Joi.object({
  comment: Joi.string().trim().allow('', null).optional(),
});

// POST /approvals/:id/reject — comment is required (FR-13)
const rejectSchema = Joi.object({
  comment: Joi.string().trim().min(1).required()
    .messages({ 'string.empty': 'A comment is required when rejecting a complaint.' }),
});

module.exports = { approveSchema, rejectSchema };
