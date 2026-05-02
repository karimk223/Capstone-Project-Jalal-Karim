/**
 * src/routes/dashboard.js
 * Implements FR-15 (role-specific dashboard counts).
 * Addresses Gap 6 (no summary view in legacy system).
 */

const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/dashboardController');

// GET /api/v1/dashboard/summary — any authenticated user, role filtering in controller
router.get('/summary', auth, ctrl.getSummary);

module.exports = router;
