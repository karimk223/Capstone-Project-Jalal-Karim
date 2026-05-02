/**
 * Express app factory. Separated from server.js so tests can import the app
 * with Supertest without binding a real port.
 */

const express = require('express');
const cors = require('cors');

const healthRoutes         = require('./routes/health');
const authRoutes           = require('./routes/auth');
const adminRoutes          = require('./routes/admin');
const complaintsRoutes     = require('./routes/complaints');
const approvalsRoutes      = require('./routes/approvals');
const attachmentsRoutes    = require('./routes/attachments');
const attachmentsTopRoutes = require('./routes/attachmentsTop');
const lookupsRoutes        = require('./routes/lookups');
const reportsRoutes        = require('./routes/reports');
const dashboardRoutes      = require('./routes/dashboard');  // B05 — FR-15
const citizensRoutes       = require('./routes/citizens');   // B04 — FR-9/10
const errorHandler         = require('./middleware/errorHandler');
const ApiError             = require('./utils/apiError');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api',                               healthRoutes);
app.use('/api/v1/auth',                       authRoutes);
app.use('/api/v1/admin',                      adminRoutes);
app.use('/api/v1/complaints',                 complaintsRoutes);
app.use('/api/v1/approvals',                  approvalsRoutes);
app.use('/api/v1/complaints/:id/attachments', attachmentsRoutes);
app.use('/api/v1/attachments',                attachmentsTopRoutes);
app.use('/api/v1/lookups',                    lookupsRoutes);
app.use('/api/v1/reports',                    reportsRoutes);
app.use('/api/v1/dashboard',                  dashboardRoutes); // B05 — FR-15
app.use('/api/v1/citizens',                   citizensRoutes);  // B04 — FR-9/10

app.use((req, res, next) => {
  next(new ApiError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`));
});

app.use(errorHandler);

module.exports = app;
