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
import type { AuthenticatedRequest } from "@cavaridge/auth/middleware";
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

  // In production: INSERT into brain_source_recordings via Drizzle
  const recording = {
    id: crypto.randomUUID(),
    tenantId,
    userId,
    title: title || `Recording ${new Date().toLocaleString()}`,
    sourceType: sourceType || "microphone",
    status: "recording",
    transcript: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  res.status(201).json(recording);
});

// Update recording (append transcript, change status)
router.patch("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;
  const { transcript, status, title } = req.body as {
    transcript?: string;
    status?: string;
    title?: string;
  };

  // In production: UPDATE brain_source_recordings SET ... WHERE id = $id AND tenant_id = $tenantId
  const updated = {
    id,
    tenantId,
    transcript,
    status,
    title,
    updatedAt: new Date().toISOString(),
  };

  res.json(updated);
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

    // Post-process the transcript
    const cleaned = await postProcessTranscript(result.text, { tenantId, userId });

    // In production: UPDATE brain_source_recordings SET transcript = $cleaned, status = 'transcribing'
    res.json({
      recordingId: req.params.id,
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

// Process transcript → extract knowledge objects
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
        recordingId: req.params.id as string,
        sourceType: "microphone",
        contextHint,
      },
      context,
    });

    // In production: INSERT extracted objects into brain_knowledge_objects,
    // brain_entity_mentions, brain_relationships + generate embeddings

    res.json({
      recordingId: req.params.id,
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

  // Post-process
  const cleaned = await postProcessTranscript(result.text, { tenantId, userId });

  res.json({
    recordingId: req.params.id,
    transcription: { ...result, text: cleaned, originalText: text },
  });
});

// List recordings
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const { page = "1", limit = "20", status } = req.query as Record<string, string>;

  // In production: SELECT * FROM brain_source_recordings WHERE tenant_id = $tenantId
  res.json({
    data: [],
    total: 0,
    page: parseInt(page, 10),
    pageSize: parseInt(limit, 10),
    hasMore: false,
  });
});

// Get single recording
router.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  // In production: SELECT * FROM brain_source_recordings WHERE id = $id AND tenant_id = $tenantId
  res.json({ id: req.params.id, tenantId });
});

// Delete recording
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  // In production: DELETE FROM brain_source_recordings WHERE id = $id AND tenant_id = $tenantId
  res.status(204).send();
});

export default router;
