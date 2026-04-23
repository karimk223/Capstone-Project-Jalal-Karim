/**
 * Joi schemas for /api/v1/complaints routes.
 * Implements NFR-2: field constraints derived from schema.sql.
 *
 * COMPLAINTS table columns used:
 *   title               VARCHAR(200) NOT NULL   → string().max(200).required()
 *   description         TEXT NOT NULL            → string().required()
 *   category            VARCHAR(100) NOT NULL    → string().max(100).required()
 *   priority            ENUM('Low','Medium','High','Urgent') NOT NULL DEFAULT 'Medium'
 *   department_id       INT NULL FK              → number().integer().optional()
 *   type_id             INT NULL FK              → number().integer().optional()
 *   citizen_id          INT NULL FK              → number().integer().optional()
 *   file_number         VARCHAR(50) NULL         → string().max(50).optional()
 *   completion_deadline DATE NULL                → date().optional()
 */

const Joi = require('joi');

// POST /complaints — create a new complaint
const create = Joi.object({
  title: Joi.string().trim().max(200).required(),
  description: Joi.string().trim().required(),
  category: Joi.string().trim().max(100).required(),
  priority: Joi.string().valid('Low', 'Medium', 'High', 'Urgent').default('Medium'),
  department_id: Joi.number().integer().allow(null).optional(),
  type_id: Joi.number().integer().allow(null).optional(),
  citizen_id: Joi.number().integer().allow(null).optional(),
  file_number: Joi.string().trim().max(50).allow('', null).optional(),
  completion_deadline: Joi.date().iso().allow(null).optional(),
});

// PATCH /complaints/:id — update editable fields (status NOT updatable here)
const update = Joi.object({
  title: Joi.string().trim().max(200).optional(),
  description: Joi.string().trim().optional(),
  priority: Joi.string().valid('Low', 'Medium', 'High', 'Urgent').optional(),
  department_id: Joi.number().integer().allow(null).optional(),
  type_id: Joi.number().integer().allow(null).optional(),
  citizen_id: Joi.number().integer().allow(null).optional(),
  completion_deadline: Joi.date().iso().allow(null).optional(),
}).min(1); // At least one field must be present

// POST /complaints/:id/transition — change status
// Implements FR-11, FR-12, FR-13
const transition = Joi.object({
  to_status_id: Joi.number().integer().min(1).max(7).required(),
  comment: Joi.string().trim().allow('', null).optional(),
});

module.exports = { create, update, transition };
