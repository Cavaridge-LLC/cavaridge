/**
 * Recordings API — CVG-BRAIN
 *
 * CRUD for source recordings + voice capture pipeline integration.
 * POST /api/v1/recordings — Create new recording (start capture)
 * PATCH /api/v1/recordings/:id — Update transcript / status
 * POST /api/v1/recordings/:id/transcribe — Whisper transcription for uploaded audio
 * POST /api/v1/recordings/:id/process — Trigger knowledge extraction from transcript
 * GET /api/v1/recordings — List recordings for tenant/user
 * GET /api/v1/recordings/:id — Get single recording
 * DELETE /api/v1/recordings/:id — Delete recording
 */

import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "@cavaridge/auth/server";
import { db } from "../db.js";
import { sourceRecordings, knowledgeObjects, entityMentions, relationships } from "../db/schema.js";
import { eq, and, desc, count } from "drizzle-orm";

function paramStr(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? "";
  return val ?? "";
}

import { transcribeAudio, postProcessTranscript, createTranscriptionResult } from "../voice/transcription.js";
import { KnowledgeExtractionAgent } from "../agents/knowledge-extraction.js";
import type { AgentContext } from "@cavaridge/agent-core";

const router = Router();
const extractionAgent = new KnowledgeExtractionAgent();

// ── Helpers ──────────────────────────────────────────────────────────

function buildAgentContext(tenantId: string, userId: string): AgentContext {
  return {
    tenantId,
    userId,
    config: {
      agentId: "brain-knowledge-extraction",
      agentName: "Brain Knowledge Extraction Agent",
      appCode: "CVG-BRAIN",
      version: "0.1.0",
    },
    correlationId: crypto.randomUUID(),
  };
}

// ── Routes ───────────────────────────────────────────────────────────

// Create a new recording
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;

  const { title, sourceType } = req.body as { title?: string; sourceType?: string };

  try {
    const [recording] = await db
      .insert(sourceRecordings)
      .values({
        tenantId,
        userId,
        title: title || `Recording ${new Date().toLocaleString()}`,
        sourceType: (sourceType as "microphone" | "upload" | "email" | "calendar" | "notes" | "connector" | "api") || "microphone",
        status: "recording",
      })
      .returning();

    res.status(201).json(recording);
  } catch (err) {
    res.status(500).json({ error: "Failed to create recording", details: err instanceof Error ? err.message : String(err) });
  }
});

// Update recording (append transcript, change status)
router.patch("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const id = paramStr(req.params.id);
  const { transcript, status, title } = req.body as {
    transcript?: string;
    status?: string;
    title?: string;
  };

  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (transcript !== undefined) updates.transcript = transcript;
    if (status !== undefined) updates.status = status;
    if (title !== undefined) updates.title = title;

    const [updated] = await db
      .update(sourceRecordings)
      .set(updates)
      .where(and(eq(sourceRecordings.id, id), eq(sourceRecordings.tenantId, tenantId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Recording not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update recording", details: err instanceof Error ? err.message : String(err) });
  }
});

// Transcribe uploaded audio via Whisper (Spaniel)
router.post("/:id/transcribe", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;

  const { audioBase64, mimeType, language } = req.body as {
    audioBase64: string;
    mimeType: string;
    language?: string;
  };

  if (!audioBase64 || !mimeType) {
    res.status(400).json({ error: "audioBase64 and mimeType are required" });
    return;
  }

  try {
    const result = await transcribeAudio(audioBase64, mimeType, { tenantId, userId, language });
    const cleaned = await postProcessTranscript(result.text, { tenantId, userId });

    // Update recording with transcript
    await db
      .update(sourceRecordings)
      .set({ transcript: cleaned, status: "transcribing", updatedAt: new Date() })
      .where(and(eq(sourceRecordings.id, paramStr(req.params.id)), eq(sourceRecordings.tenantId, tenantId)));

    res.json({
      recordingId: paramStr(req.params.id),
      transcription: {
        ...result,
        text: cleaned,
        originalText: result.text,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Transcription failed", details: err instanceof Error ? err.message : String(err) });
  }
});

// Process transcript -> extract knowledge objects
router.post("/:id/process", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;

  const { transcript, contextHint } = req.body as {
    transcript: string;
    contextHint?: string;
  };

  if (!transcript || transcript.trim().length < 10) {
    res.status(400).json({ error: "transcript must be at least 10 characters" });
    return;
  }

  try {
    const context = buildAgentContext(tenantId, userId);
    const result = await extractionAgent.runWithAudit({
      data: {
        transcript,
        recordingId: paramStr(req.params.id) as string,
        sourceType: "microphone",
        contextHint,
      },
      context,
    });

    // Store extracted knowledge objects
    for (const ko of result.result.knowledgeObjects) {
      const [stored] = await db
        .insert(knowledgeObjects)
        .values({
          tenantId,
          userId,
          recordingId: paramStr(req.params.id),
          type: ko.type,
          content: ko.content,
          summary: ko.summary,
          confidence: ko.confidence,
          tags: ko.tags,
          dueDate: ko.dueDate ? new Date(ko.dueDate) : null,
        })
        .returning();

      // Store entities
      for (const entity of ko.entities) {
        await db.insert(entityMentions).values({
          tenantId,
          name: entity.name,
          normalizedName: entity.name.toLowerCase().trim(),
          type: mapEntityType(entity.type),
          knowledgeObjectId: stored.id,
          recordingId: paramStr(req.params.id),
        });
      }
    }

    // Update recording status
    await db
      .update(sourceRecordings)
      .set({ status: "completed", updatedAt: new Date() })
      .where(and(eq(sourceRecordings.id, paramStr(req.params.id)), eq(sourceRecordings.tenantId, tenantId)));

    res.json({
      recordingId: paramStr(req.params.id),
      extraction: result.result,
      metadata: {
        executionTimeMs: result.metadata.executionTimeMs,
        tokensUsed: result.metadata.tokensUsed,
        modelsUsed: result.metadata.modelsUsed,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Knowledge extraction failed", details: err instanceof Error ? err.message : String(err) });
  }
});

// Receive finalized Web Speech API transcript from browser
router.post("/:id/web-speech", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;

  const { text, confidence, language } = req.body as {
    text: string;
    confidence: number;
    language?: string;
  };

  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const result = createTranscriptionResult(text, confidence || 0.8, language);
  const cleaned = await postProcessTranscript(result.text, { tenantId, userId });

  // Update recording
  await db
    .update(sourceRecordings)
    .set({ transcript: cleaned, status: "transcribing", updatedAt: new Date() })
    .where(and(eq(sourceRecordings.id, paramStr(req.params.id)), eq(sourceRecordings.tenantId, tenantId)));

  res.json({
    recordingId: paramStr(req.params.id),
    transcription: { ...result, text: cleaned, originalText: text },
  });
});

// List recordings
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const { page = "1", limit = "20", status } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * pageSize;

  try {
    const conditions = [eq(sourceRecordings.tenantId, tenantId)];
    if (status) {
      conditions.push(eq(sourceRecordings.status, status as "recording" | "transcribing" | "processing" | "completed" | "failed"));
    }

    const where = and(...conditions);

    const [data, totalResult] = await Promise.all([
      db.select().from(sourceRecordings).where(where).orderBy(desc(sourceRecordings.createdAt)).limit(pageSize).offset(offset),
      db.select({ total: count() }).from(sourceRecordings).where(where),
    ]);

    const total = totalResult[0]?.total ?? 0;

    res.json({
      data,
      total,
      page: pageNum,
      pageSize,
      hasMore: offset + pageSize < total,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to list recordings", details: err instanceof Error ? err.message : String(err) });
  }
});

// Get single recording
router.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  try {
    const [recording] = await db
      .select()
      .from(sourceRecordings)
      .where(and(eq(sourceRecordings.id, paramStr(req.params.id)), eq(sourceRecordings.tenantId, tenantId)));

    if (!recording) {
      res.status(404).json({ error: "Recording not found" });
      return;
    }

    res.json(recording);
  } catch (err) {
    res.status(500).json({ error: "Failed to get recording", details: err instanceof Error ? err.message : String(err) });
  }
});

// Delete recording
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  try {
    const [deleted] = await db
      .delete(sourceRecordings)
      .where(and(eq(sourceRecordings.id, paramStr(req.params.id)), eq(sourceRecordings.tenantId, tenantId)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Recording not found" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete recording", details: err instanceof Error ? err.message : String(err) });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────

function mapEntityType(type: string): "person" | "organization" | "system" | "process" | "decision" | "action_item" | "project" | "technology" | "location" | "date" | "monetary_value" | "document" | "concept" {
  const valid = ["person", "organization", "system", "process", "decision", "action_item", "project", "technology", "location", "date", "monetary_value", "document", "concept"];
  return (valid.includes(type) ? type : "concept") as ReturnType<typeof mapEntityType>;
}

export default router;
