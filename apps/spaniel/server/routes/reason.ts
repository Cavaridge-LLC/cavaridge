/**
 * POST /api/v1/reason — Primary LLM endpoint
 *
 * Accepts a SpanielRequest, routes to the appropriate model(s),
 * and returns a SpanielResponse with content, cost, and consensus info.
 */

import type { Express, Response } from "express";
import type { ServiceRequest } from "../middleware/auth.js";
import { z } from "zod";
import { chatCompletion, generateEmbedding } from "@cavaridge/spaniel";
import type { TaskType, ChatMessage } from "@cavaridge/spaniel";
import { reasonLimiter } from "../middleware/rate-limit.js";
import { logger } from "../logger.js";

const VALID_TASK_TYPES: TaskType[] = [
  "analysis",
  "generation",
  "summarization",
  "extraction",
  "chat",
  "code_generation",
  "research",
  "conversation",
  "embeddings",
  "vision",
];

const reasonRequestSchema = z.object({
  request_id: z.string().uuid().optional(),
  tenant_id: z.string().min(1),
  user_id: z.string().min(1),
  app_code: z.string().min(1),
  task_hint: z
    .enum(VALID_TASK_TYPES as [string, ...string[]])
    .nullable()
    .optional(),
  context: z.object({
    system: z.string().optional(),
    messages: z.array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.union([z.string(), z.array(z.record(z.unknown()))]),
      })
    ),
  }),
  options: z
    .object({
      require_consensus: z.boolean().optional(),
      max_tokens: z.number().int().positive().optional(),
      temperature: z.number().min(0).max(2).optional(),
      fallback_enabled: z.boolean().optional(),
    })
    .optional(),
});

const embedRequestSchema = z.object({
  tenant_id: z.string().min(1),
  user_id: z.string().optional(),
  app_code: z.string().min(1),
  input: z.union([z.string(), z.array(z.string())]),
});

export function registerReasonRoutes(app: Express): void {
  // POST /api/v1/reason — LLM chat completion
  app.post("/api/v1/reason", reasonLimiter, async (req: ServiceRequest, res: Response) => {
    const parsed = reasonRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const body = parsed.data;
    const taskType = (body.task_hint ?? "chat") as TaskType;

    try {
      const response = await chatCompletion({
        requestId: body.request_id,
        tenantId: body.tenant_id,
        userId: body.user_id,
        appCode: body.app_code,
        taskType,
        system: body.context.system,
        messages: body.context.messages as ChatMessage[],
        options: body.options
          ? {
              requireConsensus: body.options.require_consensus,
              maxTokens: body.options.max_tokens,
              temperature: body.options.temperature,
              fallbackEnabled: body.options.fallback_enabled,
            }
          : undefined,
      });

      return res.json({
        status: response.status,
        content: response.content,
        request_id: response.requestId,
        models_used: response.modelsUsed,
        consensus: response.consensus,
        tokens: response.tokens,
        cost: response.cost,
        fallback_used: response.fallbackUsed,
        timestamp: response.timestamp,
      });
    } catch (err) {
      logger.error({ err, taskType, appCode: body.app_code }, "Reason endpoint failed");
      return res.status(502).json({
        error: "LLM call failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });

  // POST /api/v1/embed — Generate embeddings
  app.post("/api/v1/embed", reasonLimiter, async (req: ServiceRequest, res: Response) => {
    const parsed = embedRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const body = parsed.data;

    try {
      const embeddings = await generateEmbedding(body.input, {
        tenantId: body.tenant_id,
        userId: body.user_id,
        appCode: body.app_code,
      });

      return res.json({
        status: "success",
        embeddings,
        dimensions: embeddings[0]?.length ?? 0,
        count: embeddings.length,
      });
    } catch (err) {
      logger.error({ err, appCode: body.app_code }, "Embed endpoint failed");
      return res.status(502).json({
        error: "Embedding generation failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });
}
