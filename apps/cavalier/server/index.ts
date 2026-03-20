/**
 * CVG-CAVALIER — Cavalier Partners Channel GTM Platform
 *
 * Express 5 API server providing:
 * - Ticket management with SLA tracking
 * - Connector management (NinjaOne, HaloPSA)
 * - Partner portal (onboarding, tier management)
 * - Billing (invoices, contracts, time entries)
 *
 * All routes enforce tenant isolation via middleware.
 */
import express from 'express';
import { createServer } from 'http';
import { ticketRouter } from './routes/tickets';
import { connectorRouter } from './routes/connectors';
import { partnerRouter } from './routes/partners';
import { billingRouter } from './routes/billing';
import { dispatchRouter } from './routes/dispatch';
import { enrichmentRouter } from './routes/enrichment';
import { tenantMiddleware } from './middleware/tenant';
import { errorHandler } from './middleware/error-handler';

const app = express();
const httpServer = createServer(app);

app.use(express.json());

// Health checks — before auth so Railway probes work without JWT
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'cavalier', version: '0.1.0' });
});

// Tenant isolation middleware on all /api routes
app.use('/api/v1', tenantMiddleware);

// API routes
app.use('/api/v1/tickets', ticketRouter);
app.use('/api/v1/connectors', connectorRouter);
app.use('/api/v1/partners', partnerRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/dispatch', dispatchRouter);
app.use('/api/v1/enrichment', enrichmentRouter);

// Error handler
app.use(errorHandler);

const port = parseInt(process.env.PORT || '5000', 10);
httpServer.listen({ port, host: '0.0.0.0' }, () => {
  console.log(`${new Date().toLocaleTimeString()} [cavalier] serving on port ${port}`);
});
