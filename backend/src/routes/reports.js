/**
 * /api/v1/reports routes â€” analytics endpoints.
 * Implements FR-15 (dashboard). All routes accessible to authenticated users.
 */

const router = require('express').Router();
const ctrl = require('../controllers/reportsController');
const auth = require('../middleware/auth');

router.get('/counts-by-status', auth, ctrl.countsByStatus);
router.get('/counts-by-category', auth, ctrl.countsByCategory);
router.get('/average-resolution-time', auth, ctrl.averageResolutionTime);
router.get('/complaints-per-staff', auth, ctrl.complaintsPerStaff);

module.exports = router;
