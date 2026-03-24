/**
 * CVG-AEGIS — Security Posture & Browser Security Platform
 *
 * Express 5 API server providing:
 * - Device enrollment and management
 * - Policy engine (URL blocking, SaaS blocking, DLP, browser config)
 * - Telemetry ingestion from browser extensions
 * - SaaS discovery and classification
 * - External posture scanning (freemium + tenant-scoped)
 * - Cavaridge Adjusted Score calculation
 *
 * Auth: @cavaridge/auth (Supabase JWT + UTM RBAC).
 * Public endpoints: enrollment POST, telemetry batch POST, scan public POST.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createAuthMiddleware } from '@cavaridge/auth/server';
import { requireAuth } from '@cavaridge/auth/server';
import { requireRole } from '@cavaridge/auth/guards';
import { ROLES } from '@cavaridge/auth';
import { profiles, tenants } from '@cavaridge/auth/schema';
import { enrollmentRouter } from './routes/enrollment';
import { deviceRouter } from './routes/devices';
import { policyRouter } from './routes/policies';
import { telemetryRouter } from './routes/telemetry';
import { saasRouter } from './routes/saas';
import { scanRouter } from './routes/scan';
import { scoreRouter } from './routes/score';
import { errorHandler } from './middleware/error-handler';
import { getDb } from './db';

const app = express();
const httpServer = createServer(app);

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// ─── Health checks (no auth) ──────────────────────────────────────────

app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'aegis', version: '0.1.0' });
});

// ─── Public endpoints (no auth) ───────────────────────────────────────
// Enrollment POST, telemetry batch POST, scan public POST, and
// policy device endpoint are device-authenticated (enrollment token / device_id),
// not user-authenticated.

app.post('/api/v1/enrollment', enrollmentRouter);
app.post('/api/v1/telemetry/batch', telemetryRouter);
app.post('/api/v1/scan/public', scanRouter);
app.get('/api/v1/policies/device/:deviceId', policyRouter);

// ─── Shared auth middleware ───────────────────────────────────────────
// Validates JWT, loads profile + tenant from DB, resolves accessible tenant IDs.
// The db object requires getDb() which returns a postgres-js-backed Drizzle instance.
// createAuthMiddleware expects NodePgDatabase — we cast since the interface is compatible.

app.use(createAuthMiddleware(getDb() as any, profiles, tenants));

// ─── Authenticated endpoints — MSP Tech minimum ──────────────────────

const mspTechGuard = [requireAuth, requireRole(ROLES.MSP_TECH)] as any[];

// Devices — read operations (MSP Tech+)
app.use('/api/v1/devices', ...mspTechGuard, deviceRouter);

// Policies — full CRUD behind auth
app.use('/api/v1/policies', ...mspTechGuard, policyRouter);

// Telemetry — dashboard reads (MSP Tech+)
app.use('/api/v1/telemetry', ...mspTechGuard, telemetryRouter);

// SaaS discovery — reads (MSP Tech+)
app.use('/api/v1/saas', ...mspTechGuard, saasRouter);

// Scans — tenant-scoped (MSP Tech+)
app.use('/api/v1/scan', ...mspTechGuard, scanRouter);

// Score — MSP Tech+ for reads, MSP Admin for writes (handled in router)
app.use('/api/v1/score', ...mspTechGuard, scoreRouter);

// Enrollment token management — MSP Admin only (auth-protected sub-routes)
app.use('/api/v1/enrollment', ...mspTechGuard, enrollmentRouter);

// ─── Static client (production) ───────────────────────────────────────

const __dirname_resolved = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(__dirname_resolved, 'client')));
app.get('/{*splat}', (_req, res) => {
  res.sendFile(join(__dirname_resolved, 'client', 'index.html'));
});

// ─── Error handler ────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT || '5000', 10);
httpServer.listen({ port, host: '0.0.0.0' }, () => {
  console.log(`${new Date().toLocaleTimeString()} [aegis] serving on port ${port}`);
});
