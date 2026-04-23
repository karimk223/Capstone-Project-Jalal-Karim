/**
 * /api/v1/complaints routes.
 * Implements FR-5, FR-6, FR-11–FR-14, FR-16, FR-17, FR-19, FR-20.
 * See api-spec.md §2 and §8.
 *
 * Route structure per coding-conventions.md §4.1:
 *   thin route file → validate middleware → controller logic
 */

const router = require('express').Router();
const ctrl = require('../controllers/complaintsController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const schemas = require('../validators/complaintSchemas');

// GET /complaints — list with filters and pagination (any authenticated user)
router.get('/', auth, ctrl.list);

// POST /complaints — create a new complaint (Clerk, Director, Admin)
router.post('/',
  auth,
  requireRole(['Clerk', 'Director', 'Admin']),
  validate(schemas.create),
  ctrl.create
);

// GET /complaints/:id — single complaint with attachments, approvals, tracking
router.get('/:id', auth, ctrl.getById);

// PATCH /complaints/:id — update editable fields (not status)
router.patch('/:id',
  auth,
  requireRole(['Clerk', 'Director', 'Admin']),
  validate(schemas.update),
  ctrl.update
);

// POST /complaints/:id/transition — change status (Director, Minister, Admin)
// Addresses Gap 1 (no status field) and Gap 6 (workflow)
router.post('/:id/transition',
  auth,
  requireRole(['Director', 'Minister', 'Admin']),
  validate(schemas.transition),
  ctrl.transition
);

// GET /complaints/:id/tracking — full audit timeline (any authenticated user)
// Addresses Gap 2 (no audit trail)
router.get('/:id/tracking', auth, ctrl.getTracking);

module.exports = router;
