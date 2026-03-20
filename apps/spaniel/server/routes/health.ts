/**
 * GET /api/v1/health — Service health check
 *
 * Returns service status, OpenRouter connectivity, and DB availability.
 */

import type { Express, Request, Response } from "express";
import { hasAICapability, hasDbCapability } from "@cavaridge/spaniel";
import { logger } from "../logger.js";

export function registerHealthRoutes(app: Express): void {
  // Public health check (no auth required — excluded in auth middleware)
  app.get("/api/v1/health", async (_req: Request, res: Response) => {
    const aiReady = hasAICapability();
    const dbReady = hasDbCapability();

    const status = aiReady ? "healthy" : "degraded";

    const health = {
      status,
      service: "spaniel",
      version: "1.0.0",
      capabilities: {
        openrouter: aiReady,
        database: dbReady,
        consensus: aiReady, // consensus requires OpenRouter
        logging: dbReady ? "database" : "stdout",
      },
      timestamp: new Date().toISOString(),
    };

    const httpStatus = status === "healthy" ? 200 : 503;

    if (!aiReady) {
      logger.warn("Health check: OPENROUTER_API_KEY not configured");
    }

    return res.status(httpStatus).json(health);
  });

  // Simple liveness probe for Railway/k8s
  app.get("/healthz", (_req: Request, res: Response) => {
    return res.status(200).json({ ok: true });
  });

  // One-time migration endpoint (POST /api/v1/migrate)
  // Protected by service auth like all /api/v1/* routes
  app.post("/api/v1/migrate", async (_req: Request, res: Response) => {
    if (!hasDbCapability()) {
      return res.status(503).json({ error: "No database configured" });
    }

    try {
      const { getDb } = await import("@cavaridge/spaniel");
      const db = getDb();
      const { sql } = await import("drizzle-orm");

      // Create spaniel schema
      await db.execute(sql`CREATE SCHEMA IF NOT EXISTS spaniel`);

      // routing_matrix
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS spaniel.routing_matrix (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          task_type TEXT NOT NULL UNIQUE,
          primary_model TEXT NOT NULL,
          secondary_model TEXT NOT NULL,
          tertiary_model TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by TEXT NOT NULL DEFAULT 'manual'
        )
      `);

      // request_log
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS spaniel.request_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          request_id UUID NOT NULL,
          tenant_id UUID NOT NULL,
          user_id UUID NOT NULL,
          app_code TEXT,
          task_type TEXT,
          primary_model TEXT,
          secondary_model TEXT,
          tertiary_model TEXT,
          model_used TEXT NOT NULL,
          fallback_used BOOLEAN DEFAULT FALSE,
          consensus_aligned BOOLEAN,
          confidence_score NUMERIC(4,3),
          tokens_input INTEGER,
          tokens_output INTEGER,
          cost_usd NUMERIC(10,6),
          status TEXT NOT NULL DEFAULT 'success',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // model_catalog
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS spaniel.model_catalog (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          model_id TEXT NOT NULL UNIQUE,
          provider TEXT NOT NULL,
          context_window INTEGER,
          cost_per_m_input NUMERIC(10,6),
          cost_per_m_output NUMERIC(10,6),
          avg_latency_ms INTEGER,
          benchmark_scores JSONB,
          active BOOLEAN DEFAULT TRUE,
          last_evaluated TIMESTAMPTZ
        )
      `);

      // Indexes
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_request_log_tenant_id ON spaniel.request_log (tenant_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_request_log_created_at ON spaniel.request_log (created_at)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_request_log_app_code ON spaniel.request_log (app_code)`);

      // RLS
      await db.execute(sql`ALTER TABLE spaniel.request_log ENABLE ROW LEVEL SECURITY`);

      // Seed routing matrix
      const routingSeeds = [
        { task: "analysis", p: "anthropic/claude-opus-4-6", s: "openai/gpt-4o", t: "google/gemini-2.5-pro" },
        { task: "generation", p: "anthropic/claude-sonnet-4", s: "openai/gpt-4o", t: "google/gemini-2.5-pro" },
        { task: "summarization", p: "anthropic/claude-sonnet-4", s: "openai/gpt-4o", t: "google/gemini-2.0-flash" },
        { task: "extraction", p: "anthropic/claude-haiku-4.5", s: "openai/gpt-4o-mini", t: "google/gemini-2.0-flash" },
        { task: "chat", p: "anthropic/claude-sonnet-4", s: "openai/gpt-4o-mini", t: "google/gemini-2.0-flash" },
        { task: "code_generation", p: "anthropic/claude-sonnet-4", s: "openai/gpt-4o", t: "google/gemini-2.5-pro" },
        { task: "research", p: "anthropic/claude-opus-4-6", s: "google/gemini-2.5-pro", t: "openai/gpt-4o" },
        { task: "conversation", p: "anthropic/claude-sonnet-4", s: "openai/gpt-4o-mini", t: "google/gemini-2.0-flash" },
        { task: "embeddings", p: "openai/text-embedding-3-small", s: "openai/text-embedding-3-large", t: null },
        { task: "vision", p: "anthropic/claude-sonnet-4", s: "openai/gpt-4o", t: "google/gemini-2.5-pro" },
      ];

      for (const r of routingSeeds) {
        await db.execute(sql`
          INSERT INTO spaniel.routing_matrix (task_type, primary_model, secondary_model, tertiary_model, updated_by)
          VALUES (${r.task}, ${r.p}, ${r.s}, ${r.t}, 'seed')
          ON CONFLICT (task_type) DO NOTHING
        `);
      }

      // Seed model catalog
      const models = [
        { id: "anthropic/claude-opus-4-6", prov: "anthropic", ctx: 200000, inp: 15.0, out: 75.0 },
        { id: "anthropic/claude-sonnet-4", prov: "anthropic", ctx: 200000, inp: 3.0, out: 15.0 },
        { id: "anthropic/claude-haiku-4.5", prov: "anthropic", ctx: 200000, inp: 0.8, out: 4.0 },
        { id: "openai/gpt-4o", prov: "openai", ctx: 128000, inp: 2.5, out: 10.0 },
        { id: "openai/gpt-4o-mini", prov: "openai", ctx: 128000, inp: 0.15, out: 0.6 },
        { id: "google/gemini-2.5-pro", prov: "google", ctx: 1000000, inp: 1.25, out: 10.0 },
        { id: "google/gemini-2.0-flash", prov: "google", ctx: 1000000, inp: 0.1, out: 0.4 },
        { id: "openai/text-embedding-3-small", prov: "openai", ctx: 8191, inp: 0.02, out: 0 },
        { id: "openai/text-embedding-3-large", prov: "openai", ctx: 8191, inp: 0.13, out: 0 },
      ];

      for (const m of models) {
        await db.execute(sql`
          INSERT INTO spaniel.model_catalog (model_id, provider, context_window, cost_per_m_input, cost_per_m_output, active)
          VALUES (${m.id}, ${m.prov}, ${m.ctx}, ${m.inp}, ${m.out}, TRUE)
          ON CONFLICT (model_id) DO NOTHING
        `);
      }

      logger.info("Migration 003_spaniel_gateway applied successfully");
      return res.json({ status: "success", message: "Spaniel schema created and seeded" });
    } catch (err) {
      logger.error({ err }, "Migration failed");
      return res.status(500).json({
        error: "Migration failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });
}
