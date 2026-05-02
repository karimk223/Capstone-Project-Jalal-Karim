const router = require('express').Router();
const ctrl = require('../controllers/complaintsController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const schemas = require('../validators/complaintSchemas');

router.get('/', auth, ctrl.list);
router.post('/', auth, requireRole(['Clerk', 'Director', 'Admin']), validate(schemas.create), ctrl.create);
router.get('/:id', auth, ctrl.getById);
router.patch('/:id', auth, requireRole(['Clerk', 'Director', 'Admin']), validate(schemas.update), ctrl.update);
router.post('/:id/transition', auth, requireRole(['Director', 'Minister', 'Admin']), validate(schemas.transition), ctrl.transition);
router.get('/:id/tracking', auth, ctrl.getTracking);

module.exports = router;
