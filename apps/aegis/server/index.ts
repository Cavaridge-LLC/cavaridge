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
 * - Compensating Controls Engine
 * - ConnectSecure integration
 * - Identity Access Review (IAR) — freemium + full tier
 * - AEGIS Probe management
 * - Penetration testing (Tier 1 Nuclei, Tier 2 NodeZero)
 * - Security posture dashboard
 * - AI analysis via Ducky (app_code=CVG-AEGIS)
 * - Report generation
 *
 * Auth: @cavaridge/auth (Supabase JWT + UTM RBAC).
 * Public endpoints: enrollment POST, telemetry batch POST, scan public POST,
 *   IAR freemium POST, probe register/heartbeat/results POST.
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
import { iarRouter } from './routes/iar';
import { compensatingControlsRouter } from './routes/compensating-controls';
import { connectSecureRouter } from './routes/connectsecure';
import { probeRouter } from './routes/probes';
import { pentestRouter } from './routes/pentest';
import { dashboardRouter } from './routes/dashboard';
import { aiAnalysisRouter } from './routes/ai-analysis';
import { reportsRouter } from './routes/reports';
import { tenantProfilesRouter } from './routes/tenant-profiles';
import { errorHandler } from './middleware/error-handler';
import { getDb } from './db';

const app = express();
const httpServer = createServer(app);

app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

// ─── Health checks (no auth) ──────────────────────────────────────────

app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'aegis', version: '0.2.0' });
});

// ─── Public endpoints (no auth) ───────────────────────────────────────
// Device enrollment, telemetry batch, public scan, IAR freemium,
// probe registration/heartbeat/results — device-authenticated, not user-authenticated.

app.post('/api/v1/enrollment', enrollmentRouter);
app.post('/api/v1/telemetry/batch', telemetryRouter);
app.post('/api/v1/scan/public', scanRouter);
app.get('/api/v1/policies/device/:deviceId', policyRouter);

// IAR freemium — public, no auth, no data retention (except lead capture)
app.post('/api/v1/iar/freemium', iarRouter);
app.post('/api/v1/iar/freemium/report', iarRouter);

// Probe public endpoints (probe-authenticated via enrollment token / probe ID)
app.post('/api/v1/probes/register', probeRouter);
app.post('/api/v1/probes/:id/heartbeat', probeRouter);
app.post('/api/v1/probes/:id/results', probeRouter);

// ─── Shared auth middleware ───────────────────────────────────────────

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

// ─── New authenticated endpoints ──────────────────────────────────────

// Identity Access Review — MSP Tech+ for reads, MSP Admin for full-tier writes
app.use('/api/v1/iar', ...mspTechGuard, iarRouter);

// Compensating Controls — MSP Tech+ for reads, MSP Admin for writes
app.use('/api/v1/compensating-controls', ...mspTechGuard, compensatingControlsRouter);

// ConnectSecure integration — MSP Tech+ for reads, MSP Admin for ingest
app.use('/api/v1/connectsecure', ...mspTechGuard, connectSecureRouter);

// Probes — MSP Tech+ for reads, MSP Admin for scan initiation
app.use('/api/v1/probes', ...mspTechGuard, probeRouter);

// Pen testing — MSP Tech+ for reads, MSP Admin for write operations
app.use('/api/v1/pentest', ...mspTechGuard, pentestRouter);

// Dashboard — MSP Tech+ for all reads
app.use('/api/v1/dashboard', ...mspTechGuard, dashboardRouter);

// AI Analysis — MSP Tech+ for most, MSP Admin for report generation
app.use('/api/v1/ai', ...mspTechGuard, aiAnalysisRouter);

// Report Generation — MSP Tech+ for reads, MSP Admin for generation
app.use('/api/v1/reports', ...mspTechGuard, reportsRouter);

// Tenant Profiles — MSP Admin for write, MSP Tech+ for read
app.use('/api/v1/tenant-profiles', ...mspTechGuard, tenantProfilesRouter);

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
