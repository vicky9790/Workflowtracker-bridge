const express = require('express');
const { prisma } = require('../config/prisma');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'connected', time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', database: 'unreachable', error: err.message });
  }
});

module.exports = router;
