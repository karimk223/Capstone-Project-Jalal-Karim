/**
 * /api/v1/approvals routes.
 * Implements FR-11, FR-13, FR-15.
 * See api-spec.md §2 (transition) and this module for approval-specific views.
 *
 * Routes:
 *   GET  /approvals/pending          — list complaints awaiting approval (Gap 6)
 *   GET  /approvals/complaint/:id    — approval history for a complaint
 *   POST /approvals/:id/approve      — approve a complaint (Pending Approval → Approved)
 *   POST /approvals/:id/reject       — reject a complaint (requires comment, FR-13)
 */

const router = require('express').Router();
const ctrl = require('../controllers/approvalsController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const schemas = require('../validators/approvalSchemas');

// GET /approvals/pending — Directors, Ministers, Admins see pending complaints
router.get('/pending',
  auth,
  requireRole(['Director', 'Minister', 'Admin']),
  ctrl.listPending
);

// GET /approvals/complaint/:id — approval history (any authenticated user)
router.get('/complaint/:id', auth, ctrl.getByComplaint);

// POST /approvals/:id/approve — approve a complaint
router.post('/:id/approve',
  auth,
  requireRole(['Director', 'Minister', 'Admin']),
  validate(schemas.approveSchema),
  ctrl.approve
);

// POST /approvals/:id/reject — reject a complaint (comment required)
router.post('/:id/reject',
  auth,
  requireRole(['Director', 'Minister', 'Admin']),
  validate(schemas.rejectSchema),
  ctrl.reject
);

module.exports = router;
