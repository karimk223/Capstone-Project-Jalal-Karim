/**
 * Attachment routes.
 * Implements FR-7, FR-8. See api-spec.md §3.
 *
 * Upload is nested under /complaints/:id/attachments.
 * Download and delete are top-level under /attachments/:id.
 * These are registered separately in server.js.
 */

const router = require('express').Router({ mergeParams: true });
const ctrl = require('../controllers/attachmentsController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const uploadMiddleware = require('../middleware/upload');

// POST /complaints/:id/attachments — upload a file (Clerk, Director, Admin)
router.post('/',
  auth,
  requireRole(['Clerk', 'Director', 'Admin']),
  uploadMiddleware.single('file'),
  ctrl.upload
);

// GET /complaints/:id/attachments — list attachments for a complaint
router.get('/', auth, ctrl.listByComplaint);

module.exports = router;
