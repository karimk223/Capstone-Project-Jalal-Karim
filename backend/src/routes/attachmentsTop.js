/**
 * Top-level attachment routes (not nested under complaints).
 * GET /attachments/:id/download — download a file
 * DELETE /attachments/:id — remove (Admin only)
 * See api-spec.md §3.
 */

const router = require('express').Router();
const ctrl = require('../controllers/attachmentsController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/rbac');

router.get('/:id/download', auth, ctrl.download);
router.delete('/:id', auth, requireRole(['Admin']), ctrl.remove);

module.exports = router;
