/**
 * Spaniel LLM Gateway — Langfuse Observability
 *
 * Wraps LLM calls with Langfuse tracing for cost, latency, and token tracking.
 * Traces include: model, tenant_id, app_code, task_type, tokens, cost, latency.
 *
 * Gracefully degrades if Langfuse is not configured (LANGFUSE_SECRET_KEY missing).
 */

import { Langfuse } from "langfuse";

let _langfuse: Langfuse | null = null;

export function hasLangfuseCapability(): boolean {
  return !!(process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_PUBLIC_KEY);
}

export function getLangfuse(): Langfuse | null {
  if (!hasLangfuseCapability()) return null;
  if (_langfuse) return _langfuse;

  _langfuse = new Langfuse({
    secretKey: process.env.LANGFUSE_SECRET_KEY!,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
    baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
    flushAt: 10,
    flushInterval: 5000,
  });

  return _langfuse;
}

export interface LangfuseTraceParams {
  requestId: string;
  tenantId: string;
  userId: string;
  appCode: string;
  taskType: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  status: "success" | "degraded" | "error";
  fallbackUsed: boolean;
  consensusAligned?: boolean | null;
}

export function traceRequest(params: LangfuseTraceParams): void {
  const langfuse = getLangfuse();
  if (!langfuse) return;

  try {
    const trace = langfuse.trace({
      id: params.requestId,
      name: `spaniel.${params.taskType}`,
      userId: params.userId,
      metadata: {
        tenantId: params.tenantId,
        appCode: params.appCode,
        taskType: params.taskType,
        status: params.status,
        fallbackUsed: params.fallbackUsed,
        consensusAligned: params.consensusAligned,
      },
      tags: [params.appCode, params.taskType, params.status],
    });

    trace.generation({
      name: "llm-call",
      model: params.model,
      usage: {
        input: params.inputTokens,
        output: params.outputTokens,
        total: params.inputTokens + params.outputTokens,
      },
      metadata: {
        costUsd: params.costUsd,
        latencyMs: params.latencyMs,
        tenantId: params.tenantId,
      },
    });
  } catch (err) {
    console.warn(
      "[spaniel] Langfuse trace failed (non-blocking):",
      err instanceof Error ? err.message : err
    );
  }
}

export async function flushLangfuse(): Promise<void> {
  if (_langfuse) {
    await _langfuse.flushAsync();
  }
}
