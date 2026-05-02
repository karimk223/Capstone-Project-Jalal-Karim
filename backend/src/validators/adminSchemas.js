/**
 * Joi schemas for /api/v1/admin routes.
 */

const Joi = require('joi');

const updateStaff = Joi.object({
  full_name: Joi.string().trim().min(2).max(100).optional(),
  email: Joi.string().email().max(100).optional(),
  role_id: Joi.number().integer().valid(1, 2, 3, 4).optional(),
  is_active: Joi.number().integer().valid(0, 1).optional(),
}).min(1);

const resetStaffPassword = Joi.object({
  password: Joi.string().min(6).max(100).required().messages({
    'any.required': 'New password is required.',
    'string.empty': 'New password is required.',
    'string.min': 'Password must be at least 6 characters.',
    'string.max': 'Password must be at most 100 characters.',
  }),
});

module.exports = {
  updateStaff,
  resetStaffPassword,
};