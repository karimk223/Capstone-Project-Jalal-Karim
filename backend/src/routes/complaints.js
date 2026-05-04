const router = require('express').Router();
const ctrl = require('../controllers/complaintsController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const schemas = require('../validators/complaintSchemas');

router.get('/', auth, ctrl.list);

// Admin remains allowed to create complaints as before.
// Admin is blocked from editing/transitioning existing complaints inside the controller.
router.post(
  '/',
  auth,
  requireRole(['Clerk', 'Director', 'Admin']),
  validate(schemas.create),
  ctrl.create
);

router.get('/:id', auth, ctrl.getById);

// Backend controller enforces the detailed edit permissions.
router.patch(
  '/:id',
  auth,
  requireRole(['Clerk', 'Director', 'Minister']),
  validate(schemas.update),
  ctrl.update
);

// Backend controller enforces the detailed workflow permissions.
// Admin is intentionally not allowed to transition complaint workflow.
router.post(
  '/:id/transition',
  auth,
  requireRole(['Clerk', 'Director', 'Minister']),
  validate(schemas.transition),
  ctrl.transition
);

router.get('/:id/tracking', auth, ctrl.getTracking);

module.exports = router;