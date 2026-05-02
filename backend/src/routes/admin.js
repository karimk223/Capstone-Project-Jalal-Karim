/**
 * src/routes/admin.js
 * Admin-only routes.
 * B07: added complaint-types and referral-destinations CRUD (FR-21).
 */

const router = require('express').Router();

const authCtrl = require('../controllers/authController');
const adminCtrl = require('../controllers/adminController');

const auth = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');

const authSchemas = require('../validators/authSchemas');
const adminSchemas = require('../validators/adminSchemas');

// ── Staff management ───────────────────────────────────────────────────────
router.get(
  '/staff',
  auth,
  requireRole(['Admin']),
  adminCtrl.listStaff
);

router.post(
  '/staff',
  auth,
  requireRole(['Admin']),
  validate(authSchemas.createStaff),
  authCtrl.createStaff
);

router.patch(
  '/staff/:id',
  auth,
  requireRole(['Admin']),
  validate(adminSchemas.updateStaff),
  adminCtrl.updateStaff
);

router.patch(
  '/staff/:id/password',
  auth,
  requireRole(['Admin']),
  validate(adminSchemas.resetStaffPassword),
  adminCtrl.resetStaffPassword
);

// ── Lookup table management (B07 — FR-21) ─────────────────────────────────
router.post(
  '/complaint-types',
  auth,
  requireRole(['Admin']),
  adminCtrl.createComplaintType
);

router.patch(
  '/complaint-types/:id',
  auth,
  requireRole(['Admin']),
  adminCtrl.updateComplaintType
);

router.post(
  '/referral-destinations',
  auth,
  requireRole(['Admin']),
  adminCtrl.createReferralDestination
);

router.patch(
  '/referral-destinations/:id',
  auth,
  requireRole(['Admin']),
  adminCtrl.updateReferralDestination
);

module.exports = router;