/**
 * Express application entry point.
 *
 * Middleware order matters:
 *   1. cors          — allow frontend origin
 *   2. express.json  — parse JSON bodies
 *   3. routes        — /api/health (public), /api/v1/* (mix of public and auth'd)
 *   4. 404 handler   — unmatched routes
 *   5. errorHandler  — formats errors into the api-spec.md §9 shape (last!)
 */

const express = require('express');
const cors = require('cors');

const env = require('./config/env');
// Requiring db here triggers the boot-time ping in config/db.js — fail fast if MySQL is down.
require('./config/db');

const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const errorHandler = require('./middleware/errorHandler');
const ApiError = require('./utils/apiError');

const app = express();

// ── Global middleware ────────────────────────────────────────────────────────
// CORS: default (permissive) is fine for the demo; production hardening is
// explicitly out of MVP scope per requirements.md NFR-7.
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ── Routes ───────────────────────────────────────────────────────────────────
// /api/health exists outside the versioned namespace so monitoring tools
// don't break when we bump the API version.
app.use('/api', healthRoutes);

// Versioned API surface per api-spec.md
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);

// ── 404 and error handling ───────────────────────────────────────────────────
app.use((req, res, next) => {
  next(new ApiError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`));
});

app.use(errorHandler);

// ── Start server ─────────────────────────────────────────────────────────────
app.listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port}`);
  console.log(`[server] env: ${env.nodeEnv}`);
});

module.exports = app; // exported for future supertest integration tests
