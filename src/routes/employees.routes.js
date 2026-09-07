const express = require('express');
const controller = require('../controllers/employees.controller');
const { requireAdminAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const schemas = require('../utils/schemas');
const { strict } = require('../middleware/rateLimit');

const router = express.Router();

router.use(requireAdminAuth, requireRole('ORG_ADMIN'));

router.post('/', validate({ body: schemas.employees.create }), controller.create);
router.get('/', validate({ query: schemas.employees.list }), controller.list);
router.get('/:id', validate({ params: schemas.employees.idParam }), controller.getById);
// Issuing a code creates a credential, so it is rate-limited like the
// other credential-minting endpoints.
router.post('/:id/activation', strict, validate({ params: schemas.employees.idParam }), controller.issueActivation);

router.patch('/:id', validate({ params: schemas.employees.idParam, body: schemas.employees.update }), controller.update);

module.exports = router;
