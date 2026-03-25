/**
 * CVG-CORE — Platform Administration Control Plane
 *
 * Express 5 API server providing:
 * - Tenant management (4-tier UTM hierarchy)
 * - User management (6 RBAC roles)
 * - Role management & audit
 * - App registry & health monitoring
 * - Platform analytics
 * - Audit log viewer with CSV export
 * - Configuration management (feature flags, rate limits, maintenance mode)
 * - Billing/usage tracking
 * - Connector marketplace
 * - Database health monitoring
 *
 * All routes under /api/v1/admin/ require Platform Admin role via @cavaridge/auth.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { tenantRouter } from './routes/tenants.js';
import { userRouter } from './routes/users.js';
import { roleRouter } from './routes/roles.js';
import { appRouter } from './routes/apps.js';
import { analyticsRouter } from './routes/analytics.js';
import { settingsRouter } from './routes/settings.js';
import { auditRouter } from './routes/audit.js';
import { billingRouter } from './routes/billing.js';
import { connectorMarketplaceRouter } from './routes/connectors.js';
import { databaseRouter } from './routes/database.js';
import { loadUser, requireAuth, requirePlatformRole } from './auth.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();
const httpServer = createServer(app);

app.use(cookieParser());
app.use(express.json());

// Health checks — before auth so Railway probes work without JWT
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'core', version: '0.1.0' });
});

// Shared auth: load user from Supabase JWT, then enforce Platform Admin
app.use(loadUser as any);
app.use('/api/v1/admin', requireAuth as any, requirePlatformRole as any);

// Admin API routes — all under /api/v1/admin/
app.use('/api/v1/admin/tenants', tenantRouter);
app.use('/api/v1/admin/users', userRouter);
app.use('/api/v1/admin/roles', roleRouter);
app.use('/api/v1/admin/apps', appRouter);
app.use('/api/v1/admin/analytics', analyticsRouter);
app.use('/api/v1/admin/settings', settingsRouter);
app.use('/api/v1/admin/audit', auditRouter);
app.use('/api/v1/admin/billing', billingRouter);
app.use('/api/v1/admin/connectors', connectorMarketplaceRouter);
app.use('/api/v1/admin/database', databaseRouter);

// Error handler
app.use(errorHandler);

const port = parseInt(process.env.PORT || '5010', 10);
httpServer.listen({ port, host: '0.0.0.0' }, () => {
  console.log(`${new Date().toLocaleTimeString()} [core] serving on port ${port}`);
});
