/**
 * CVG-CORE — Platform Governance Dashboard
 *
 * Express 5 API server providing:
 * - Tenant management (4-tier UTM hierarchy)
 * - User management (6 RBAC roles)
 * - App registry & health monitoring
 * - Platform settings & feature flags
 * - Audit log viewer
 * - Connector marketplace
 * - Database health monitoring
 *
 * All routes require Platform Admin role.
 */
import express from 'express';
import { createServer } from 'http';
import { tenantRouter } from './routes/tenants';
import { userRouter } from './routes/users';
import { appRouter } from './routes/apps';
import { settingsRouter } from './routes/settings';
import { auditRouter } from './routes/audit';
import { connectorMarketplaceRouter } from './routes/connectors';
import { databaseRouter } from './routes/database';
import { platformAdminMiddleware } from './middleware/platform-admin';
import { errorHandler } from './middleware/error-handler';

const app = express();
const httpServer = createServer(app);

app.use(express.json());

// Health checks — before auth so Railway probes work without JWT
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'core', version: '0.1.0' });
});

// Platform Admin guard on all /api routes
app.use('/api/v1', platformAdminMiddleware);

// API routes
app.use('/api/v1/tenants', tenantRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/apps', appRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/audit', auditRouter);
app.use('/api/v1/connectors', connectorMarketplaceRouter);
app.use('/api/v1/database', databaseRouter);

// Error handler
app.use(errorHandler);

const port = parseInt(process.env.PORT || '5010', 10);
httpServer.listen({ port, host: '0.0.0.0' }, () => {
  console.log(`${new Date().toLocaleTimeString()} [core] serving on port ${port}`);
});
