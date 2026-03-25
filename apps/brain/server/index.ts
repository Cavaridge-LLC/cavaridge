/**
 * CVG-BRAIN — Voice-First Knowledge Capture & Recall
 *
 * Express 5 server with:
 * - Voice capture pipeline (Web Speech API + Whisper fallback)
 * - Knowledge extraction agent (Language Agent + Data Extractor)
 * - Semantic recall via Ducky -> Spaniel
 * - 11 integration connectors (Phase 1: M365 calendar + email)
 * - WebSocket for real-time transcription streaming
 */

import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import type { WebSocket as WSType } from "ws";
import { loadUser, requireAuth, type AuthenticatedRequest } from "./auth.js";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import capturesRouter from "./routes/captures.js";
import recordingsRouter from "./routes/recordings.js";
import knowledgeRouter from "./routes/knowledge.js";
import entitiesRouter from "./routes/entities.js";
import relationshipsRouter from "./routes/relationships.js";
import recallRouter from "./routes/recall.js";
import connectorsRouter from "./routes/connectors.js";

const app = express();
const httpServer = createServer(app);

// ── Middleware ────────────────────────────────────────────────────────

app.use(express.json({ limit: "50mb" })); // Large limit for audio uploads

// CORS for dev (in production, configure per-environment)
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.CLIENT_ORIGIN || "http://localhost:5173");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-Id, X-User-Id");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// ── Health Checks (before auth) ──────────────────────────────────────

app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/api/v1/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "brain",
    version: "0.1.0",
    modes: { dump: true, recall: true, operate: false, surface: false },
    connectors: { m365Calendar: true, m365Email: true, stubs: 9 },
  });
});

// ── Auth Middleware (after health, before API routes) ─────────────────

app.use(loadUser as express.RequestHandler);

// ── API Routes (MSP Tech minimum) ───────────────────────────────────

const authGuard = requireAuth as express.RequestHandler;
const mspTechGuard = requireRole(ROLES.MSP_TECH) as express.RequestHandler;

app.use("/api/v1/captures", authGuard, mspTechGuard, capturesRouter);
app.use("/api/v1/recordings", authGuard, mspTechGuard, recordingsRouter);
app.use("/api/v1/knowledge", authGuard, mspTechGuard, knowledgeRouter);
app.use("/api/v1/entities", authGuard, mspTechGuard, entitiesRouter);
app.use("/api/v1/relationships", authGuard, mspTechGuard, relationshipsRouter);
app.use("/api/v1/recall", authGuard, mspTechGuard, recallRouter);
app.use("/api/v1/connectors", authGuard, mspTechGuard, connectorsRouter);

// ── Error Handler ────────────────────────────────────────────────────

app.use(
  (
    err: Error & { status?: number; statusCode?: number },
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(`[brain] Error ${status}: ${message}`);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ error: message });
  },
);

// ── WebSocket for Real-Time Transcription ────────────────────────────

const wss = new WebSocketServer({ server: httpServer, path: "/ws/transcribe" });

wss.on("connection", (ws: WSType, req) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const tenantId = url.searchParams.get("tenantId") || "";
  const userId = url.searchParams.get("userId") || "";
  const recordingId = url.searchParams.get("recordingId") || crypto.randomUUID();

  console.log(`[brain/ws] Client connected: tenant=${tenantId} user=${userId} recording=${recordingId}`);

  ws.on("message", (data: Buffer | string) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case "transcript_interim":
          ws.send(JSON.stringify({
            type: "transcript_interim",
            recordingId,
            text: msg.text,
            confidence: msg.confidence,
            timestamp: Date.now(),
          }));
          break;

        case "transcript_final":
          ws.send(JSON.stringify({
            type: "transcript_final",
            recordingId,
            text: msg.text,
            confidence: msg.confidence,
            timestamp: Date.now(),
          }));
          break;

        case "recording_stop":
          ws.send(JSON.stringify({
            type: "recording_stopped",
            recordingId,
            timestamp: Date.now(),
          }));
          break;

        default:
          ws.send(JSON.stringify({ type: "error", message: `Unknown message type: ${msg.type}` }));
      }
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
    }
  });

  ws.on("close", () => {
    console.log(`[brain/ws] Client disconnected: recording=${recordingId}`);
  });

  ws.send(JSON.stringify({
    type: "connected",
    recordingId,
    tenantId,
    userId,
    timestamp: Date.now(),
  }));
});

// ── Start Server ─────────────────────────────────────────────────────

const port = parseInt(process.env.PORT || "5004", 10);
httpServer.listen({ port, host: "0.0.0.0" }, () => {
  console.log(`${new Date().toLocaleTimeString()} [brain] serving on port ${port}`);
  console.log(`  API: http://localhost:${port}/api/v1/health`);
  console.log(`  WS:  ws://localhost:${port}/ws/transcribe`);
});
