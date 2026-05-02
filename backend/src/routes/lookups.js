/**
 * src/routes/lookups.js
 * All lookup endpoints require a valid JWT but no specific role.
 * B07/B08: added referral-destinations route (FR-22).
 */

const router = require('express').Router();
const ctrl   = require('../controllers/lookupsController');
const auth   = require('../middleware/auth');

router.get('/statuses',               auth, ctrl.getStatuses);
router.get('/departments',            auth, ctrl.getDepartments);
router.get('/complaint-types',        auth, ctrl.getComplaintTypes);
router.get('/roles',                  auth, ctrl.getRoles);
router.get('/referral-destinations',  auth, ctrl.getReferralDestinations); // B08 — FR-22

module.exports = router;
