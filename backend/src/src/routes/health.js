/**
 * GET /api/health — simple liveness check.
 * Confirms the server is up and the DB pool can answer a trivial query.
 * Used for smoke testing during development and (later) as the uptime probe.
 */

const router = require('express').Router();
const db = require('../config/db');

router.get('/health', async (req, res) => {
  try {
    // `SELECT 1` is the universal "are you there" query — touches the DB without locking anything.
    const [rows] = await db.execute('SELECT 1 AS ok');
    return res.json({
      status: 'ok',
      db: rows[0].ok === 1 ? 'connected' : 'unknown',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // Don't go through the central error handler — health checks should return
    // a 200 with a "degraded" body OR a 503 so monitoring tools can distinguish.
    return res.status(503).json({
      status: 'degraded',
      db: 'unreachable',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
