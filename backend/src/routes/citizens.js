/**
 * src/routes/citizens.js
 * Implements FR-9 (link complaint to citizen), FR-10 (duplicate national_id).
 * Addresses Gap 10 (no de-duplicated applicant record in legacy system).
 */

const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/citizensController');

router.get('/',  auth, ctrl.search);   // GET /citizens?q=...
router.post('/', auth, ctrl.create);   // POST /citizens

module.exports = router;
