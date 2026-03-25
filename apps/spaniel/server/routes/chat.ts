/**
 * POST /api/v1/chat — Primary LLM chat completion endpoint (spec-compliant name)
 *
 * Supports both standard JSON responses and SSE streaming.
 * Set `stream: true` in the request body to receive Server-Sent Events.
 *
 * This is the canonical endpoint name per the CVG-AI architecture spec.
 * POST /api/v1/reason is preserved as an alias for backward compatibility.
 */

import type { Express, Response } from "express";
import type { ServiceRequest } from "../middleware/auth.js";
import { z } from "zod";
import { chatCompletion, chatCompletionStream } from "@cavaridge/spaniel";
import type { TaskType, ChatMessage } from "@cavaridge/spaniel";
import { reasonLimiter } from "../middleware/rate-limit.js";
import { tenantRateLimit } from "../middleware/tenant-rate-limit.js";
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

const chatRequestSchema = z.object({
  request_id: z.string().uuid().optional(),
  tenant_id: z.string().min(1),
  user_id: z.string().min(1),
  app_code: z.string().min(1),
  task_hint: z
    .enum(VALID_TASK_TYPES as [string, ...string[]])
    .nullable()
    .optional(),
  stream: z.boolean().optional().default(false),
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

async function handleChatRequest(req: ServiceRequest, res: Response) {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const body = parsed.data;
  const taskType = (body.task_hint ?? "chat") as TaskType;

  // Streaming response
  if (body.stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    await chatCompletionStream(
      {
        requestId: body.request_id,
        tenantId: body.tenant_id,
        userId: body.user_id,
        appCode: body.app_code,
        taskType,
        system: body.context.system,
        messages: body.context.messages as ChatMessage[],
        options: body.options
          ? {
              maxTokens: body.options.max_tokens,
              temperature: body.options.temperature,
              fallbackEnabled: body.options.fallback_enabled,
            }
          : undefined,
      },
      {
        onToken(token: string) {
          res.write(`data: ${JSON.stringify({ type: "token", content: token })}\n\n`);
        },
        onDone(metadata) {
          res.write(`data: ${JSON.stringify({ type: "done", ...metadata })}\n\n`);
          res.end();
        },
        onError(error: Error) {
          res.write(
            `data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`
          );
          res.end();
        },
      }
    );
    return;
  }

  // Standard JSON response
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
    logger.error({ err, taskType, appCode: body.app_code }, "Chat endpoint failed");
    return res.status(502).json({
      error: "LLM call failed",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

export function registerChatRoutes(app: Express): void {
  const middleware = [reasonLimiter, tenantRateLimit()];

  // Canonical endpoint per spec
  app.post("/api/v1/chat", ...middleware, handleChatRequest);
}
