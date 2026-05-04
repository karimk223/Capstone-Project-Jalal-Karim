/**
 * Joi schemas for /api/v1/complaints routes.
 */

const Joi = require('joi');

const create = Joi.object({
  title: Joi.string().trim().max(200).required().messages({
    'any.required': 'Title is required.',
    'string.empty': 'Title is required.',
    'string.max': 'Title must be at most 200 characters.',
  }),

  description: Joi.string().trim().required().messages({
    'any.required': 'Description is required.',
    'string.empty': 'Description is required.',
  }),

  category: Joi.string().trim().max(100).required().messages({
    'any.required': 'Category is required.',
    'string.empty': 'Category is required.',
    'string.max': 'Category must be at most 100 characters.',
  }),

  priority: Joi.string()
    .valid('Low', 'Medium', 'High', 'Urgent')
    .default('Medium'),

  department_id: Joi.number().integer().required().messages({
    'any.required': 'Department is required.',
    'number.base': 'Department is required.',
  }),

  type_id: Joi.number().integer().required().messages({
    'any.required': 'Complaint type is required.',
    'number.base': 'Complaint type is required.',
  }),

  citizen_id: Joi.number().integer().allow(null).optional(),

  // Allowed only on create. File number is generated once and cannot be edited later.
  file_number: Joi.string().trim().max(50).allow('', null).optional().messages({
    'string.max': 'File number must be at most 50 characters.',
  }),

  completion_deadline: Joi.date().iso().allow(null).optional(),
});

const update = Joi.object({
  title: Joi.string().trim().max(200).optional(),
  description: Joi.string().trim().optional(),
  category: Joi.string().trim().max(100).optional(),
  priority: Joi.string().valid('Low', 'Medium', 'High', 'Urgent').optional(),

  department_id: Joi.number().integer().optional(),
  type_id: Joi.number().integer().optional(),
  citizen_id: Joi.number().integer().allow(null).optional(),

  completion_deadline: Joi.date().iso().allow(null).optional(),
}).min(1);

const transition = Joi.object({
  to_status_id: Joi.number().integer().min(1).max(7).required(),
  comment: Joi.string().trim().allow('', null).optional(),
});

module.exports = { create, update, transition };