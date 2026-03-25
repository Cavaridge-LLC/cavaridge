/**
 * V1 App Query API — Integration layer for other Cavaridge apps.
 *
 * POST /api/v1/app-query — Other apps (Meridian, Midas, HIPAA, etc.) call
 * Ducky for AI reasoning instead of calling Spaniel directly. Ducky adds
 * context, prompt templates, and tenant awareness on top of raw LLM calls.
 *
 * Accepts: app_code, task_type, and payload.
 */

import type { Express, Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../../auth.js";
import {
  chatCompletion,
  hasAICapability,
  traceRequest,
} from "@cavaridge/spaniel";
import type { ChatMessage } from "@cavaridge/spaniel";
import { resolveTemplate, buildPromptFromTemplate } from "../../prompt-templates.js";
import { DUCKY_BRANDING } from "../../ducky-state.js";
import { logger } from "../../logger.js";

// Valid Cavaridge app codes that can call Ducky
const VALID_APP_CODES = [
  "CVG-CORE",
  "CVG-AI",
  "CVG-RESEARCH",
  "CVG-CAELUM",
  "CVG-FORGE",
  "CVG-MER",
  "CVG-HIPAA",
  "CVG-AEGIS",
  "CVG-MIDAS",
  "CVG-VESPAR",
  "CVG-ASTRA",
  "CVG-CERES",
  "CVG-BRAIN",
  "CVG-CAVALIER",
] as const;

const appQuerySchema = z.object({
  app_code: z.enum(VALID_APP_CODES),
  task_type: z.string().min(1).max(64),
  payload: z.object({
    system: z.string().max(20000).optional(),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string(),
        }),
      )
      .min(1),
    variables: z.record(z.string()).optional(),
  }),
  options: z
    .object({
      requireConsensus: z.boolean().optional(),
      maxTokens: z.number().int().positive().optional(),
      temperature: z.number().min(0).max(2).optional(),
      fallbackEnabled: z.boolean().optional(),
    })
    .optional(),
});

export function registerV1AppQueryRoutes(app: Express): void {
  app.post("/api/v1/app-query", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = appQuerySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      }

      const { app_code, task_type, payload, options } = parsed.data;

      if (!hasAICapability()) {
        return res.status(503).json({ error: "AI features not configured" });
      }

      // Resolve prompt template for the calling app + task type
      let systemPrompt = payload.system;
      const template = await resolveTemplate(req.tenantId!, app_code, task_type);
      if (template) {
        const variables = {
          ...payload.variables,
          app_code,
          task_type,
          tenant_id: req.tenantId!,
        };
        const built = buildPromptFromTemplate(template, variables);
        systemPrompt = built.system;

        // If template has a user prompt, prepend it
        if (built.userPrompt) {
          const lastUserMsgIndex = payload.messages.findLastIndex((m) => m.role === "user");
          if (lastUserMsgIndex >= 0) {
            payload.messages[lastUserMsgIndex].content =
              built.userPrompt + "\n\n" + payload.messages[lastUserMsgIndex].content;
          }
        }
      }

      // Add Ducky identity to system prompt if not already provided
      if (!systemPrompt) {
        systemPrompt =
          `You are ${DUCKY_BRANDING.CHARACTER_NAME}, the AI reasoning engine for the Cavaridge platform. ` +
          `You are being called by the ${app_code} application for a ${task_type} task. ` +
          "Provide accurate, well-structured responses. Be thorough but concise.";
      }

      const chatMessages: ChatMessage[] = payload.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const startTime = Date.now();

      const spanielResponse = await chatCompletion({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        appCode: app_code,
        taskType: task_type as any,
        system: systemPrompt,
        messages: chatMessages,
        options: options
          ? {
              requireConsensus: options.requireConsensus,
              maxTokens: options.maxTokens,
              temperature: options.temperature,
              fallbackEnabled: options.fallbackEnabled,
            }
          : undefined,
      });

      const latencyMs = Date.now() - startTime;

      // Langfuse tracing with app_code context
      traceRequest({
        requestId: spanielResponse.requestId,
        tenantId: req.tenantId!,
        userId: req.user!.id,
        appCode: app_code,
        taskType: task_type as any,
        model: spanielResponse.modelsUsed.primary,
        inputTokens: spanielResponse.tokens.input,
        outputTokens: spanielResponse.tokens.output,
        costUsd: spanielResponse.cost.amount,
        latencyMs,
        status: spanielResponse.status,
        fallbackUsed: spanielResponse.fallbackUsed,
      });

      return res.json({
        status: spanielResponse.status,
        content: spanielResponse.content,
        requestId: spanielResponse.requestId,
        modelsUsed: spanielResponse.modelsUsed,
        consensus: spanielResponse.consensus,
        tokens: spanielResponse.tokens,
        cost: spanielResponse.cost,
        fallbackUsed: spanielResponse.fallbackUsed,
        latencyMs,
        branding: DUCKY_BRANDING.FOOTER_TAGLINE,
      });
    } catch (err) {
      logger.error({ err }, "App query failed");
      return res.status(500).json({ error: "Failed to process app query" });
    }
  });
}
