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
 * All routes enforce tenant isolation via middleware.
 */
import express from 'express';
import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { enrollmentRouter } from './routes/enrollment';
import { deviceRouter } from './routes/devices';
import { policyRouter } from './routes/policies';
import { telemetryRouter } from './routes/telemetry';
import { saasRouter } from './routes/saas';
import { scanRouter } from './routes/scan';
import { scoreRouter } from './routes/score';
import { tenantMiddleware } from './middleware/tenant';
import { errorHandler } from './middleware/error-handler';

const app = express();
const httpServer = createServer(app);

app.use(express.json({ limit: '1mb' }));

// ─── Health checks (no auth) ──────────────────────────────────────────

app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'aegis', version: '0.1.0' });
});

// ─── Public endpoints (no auth) ───────────────────────────────────────

// Device enrollment — extension calls this with enrollment token
app.post('/api/v1/enroll', (req, res, next) => {
  enrollmentRouter(req, res, next);
});

// Telemetry batch — extension calls this with device_id
app.post('/api/v1/telemetry/batch', (req, res, next) => {
  telemetryRouter(req, res, next);
});

// Freemium scan — public landing page
app.post('/api/v1/scan/public', (req, res, next) => {
  scanRouter(req, res, next);
});

// Policy fetch for device — uses device_id not tenant auth
app.get('/api/v1/policies/device/:deviceId', (req, res, next) => {
  policyRouter(req, res, next);
});

// ─── Authenticated endpoints ──────────────────────────────────────────

app.use('/api/v1', tenantMiddleware);

app.use('/api/v1/devices', deviceRouter);
app.use('/api/v1/policies', policyRouter);
app.use('/api/v1/telemetry', telemetryRouter);
app.use('/api/v1/saas', saasRouter);
app.use('/api/v1/scan', scanRouter);
app.use('/api/v1/score', scoreRouter);
app.use('/api/v1/enrollment', enrollmentRouter);

// ─── Static client (production) ───────────────────────────────────────

const __dirname_resolved = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(__dirname_resolved, 'client')));
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname_resolved, 'client', 'index.html'));
});

// ─── Error handler ────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT || '5000', 10);
httpServer.listen({ port, host: '0.0.0.0' }, () => {
  console.log(`${new Date().toLocaleTimeString()} [aegis] serving on port ${port}`);
});
