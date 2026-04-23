/**
 * /api/v1/admin routes — all require the Admin role.
 * This file currently holds only staff creation; admin lookup-table management
 * (complaint-types, referral-destinations) will be added on Day 2 per api-spec.md §6.
 */

const router = require('express').Router();
const ctrl = require('../controllers/authController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const schemas = require('../validators/authSchemas');

// POST /admin/staff — create a new ministry account.
// Implements FR-1 (account creation by admin). Addresses Gap 5 (server-side RBAC).
router.post(
  '/staff',
  auth,
  requireRole(['Admin']),
  validate(schemas.createStaff),
  ctrl.createStaff
);

module.exports = router;
