const express = require('express');
const controller = require('../controllers/integrations.controller');
const { requireIntegrationAuth } = require('../middleware/integrationAuth');
const { validate } = require('../middleware/validate');
const schemas = require('../utils/schemas');
const { strict } = require('../middleware/rateLimit');

const router = express.Router();

router.post(
  '/creator/employees/:employeeId/activation',
  strict,
  requireIntegrationAuth,
  validate({
    params: schemas.integrations.creatorActivationParams,
    body: schemas.integrations.creatorActivationBody,
  }),
  controller.issueCreatorActivation
);

module.exports = router;
