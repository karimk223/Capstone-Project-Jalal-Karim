/**
 * /api/v1/admin routes â€” all require Admin role.
 * Implements FR-1 (create accounts), FR-4 (disable accounts).
 * See api-spec.md Â§6.
 */

const router = require('express').Router();
const authCtrl = require('../controllers/authController');
const adminCtrl = require('../controllers/adminController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const authSchemas = require('../validators/authSchemas');
const adminSchemas = require('../validators/adminSchemas');

// All admin routes require authentication + Admin role
router.use(auth, requireRole(['Admin']));

// Staff management
router.get('/staff', adminCtrl.listStaff);
router.post('/staff', validate(authSchemas.createStaff), authCtrl.createStaff);
router.patch('/staff/:id', validate(adminSchemas.updateStaff), adminCtrl.updateStaff);

module.exports = router;
