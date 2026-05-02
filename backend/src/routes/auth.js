/**
 * /api/v1/auth routes.
 * Implements FR-1, FR-2. See api-spec.md §1.
 *
 * Login is public. /auth/me and /auth/logout require a valid JWT.
 * Account creation is under /admin/staff (see routes/admin.js), not here.
 */

const router = require('express').Router();
const ctrl = require('../controllers/authController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/authSchemas');

router.post('/login', validate(schemas.login), ctrl.login);
router.post('/logout', auth, ctrl.logout);
router.get('/me', auth, ctrl.me);
router.post('/change-password', auth, ctrl.changePassword);

module.exports = router;
