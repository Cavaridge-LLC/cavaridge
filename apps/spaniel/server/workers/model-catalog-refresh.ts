/**
 * BullMQ Worker — Model Catalog Refresh
 *
 * Weekly job that pulls available models from the OpenRouter catalog API
 * and upserts them into the spaniel.model_catalog table.
 *
 * Schedule: runs once per week (configurable via CATALOG_REFRESH_CRON).
 * Can also be triggered manually via POST /api/v1/models/refresh-catalog.
 */

import { Queue, Worker, QueueEvents } from "bullmq";
import type { Job, ConnectionOptions } from "bullmq";
import { hasRedisCapability, hasDbCapability, getDb, hasAICapability } from "@cavaridge/spaniel";
import { modelCatalog } from "@cavaridge/spaniel/schema";
import { logger } from "../logger.js";

const QUEUE_NAME = "spaniel:model-catalog-refresh";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

// Default: weekly on Sunday at 3 AM UTC
const DEFAULT_CRON = "0 3 * * 0";

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  top_provider?: {
    max_completion_tokens?: number;
  };
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

function getConnectionOpts(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL!);
  return {
    host: url.hostname,
    port: parseInt(url.port || "6379", 10),
    password: url.password || undefined,
    username: url.username || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

let _queue: Queue | null = null;
let _worker: Worker | null = null;

export function getModelCatalogQueue(): Queue | null {
  if (!hasRedisCapability()) return null;
  if (_queue) return _queue;

  _queue = new Queue(QUEUE_NAME, { connection: getConnectionOpts() });
  return _queue;
}

async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY required for model catalog refresh");
  }

  const response = await fetch(OPENROUTER_MODELS_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://spaniel.cavaridge.com",
      "X-Title": "CVG-AI",
    },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API returned ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as OpenRouterModelsResponse;
  return data.data ?? [];
}

async function processModelCatalogRefresh(_job: Job): Promise<{ modelsProcessed: number }> {
  if (!hasDbCapability()) {
    logger.warn("Model catalog refresh skipped — no database configured");
    return { modelsProcessed: 0 };
  }

  if (!hasAICapability()) {
    logger.warn("Model catalog refresh skipped — no OpenRouter API key");
    return { modelsProcessed: 0 };
  }

  logger.info("Starting model catalog refresh from OpenRouter...");

  const models = await fetchOpenRouterModels();
  const db = getDb();
  let processed = 0;

  for (const model of models) {
    try {
      // Parse pricing (OpenRouter returns per-token strings)
      const costPerMInput = parseFloat(model.pricing.prompt) * 1_000_000;
      const costPerMOutput = parseFloat(model.pricing.completion) * 1_000_000;

      // Extract provider from model ID (e.g., "anthropic/claude-3" → "anthropic")
      const provider = model.id.split("/")[0] ?? "unknown";

      await db
        .insert(modelCatalog)
        .values({
          modelId: model.id,
          provider,
          contextWindow: model.context_length ?? null,
          costPerMInput: costPerMInput.toFixed(6),
          costPerMOutput: costPerMOutput.toFixed(6),
          active: true,
          lastEvaluated: new Date(),
        })
        .onConflictDoUpdate({
          target: modelCatalog.modelId,
          set: {
            provider,
            contextWindow: model.context_length ?? null,
            costPerMInput: costPerMInput.toFixed(6),
            costPerMOutput: costPerMOutput.toFixed(6),
            lastEvaluated: new Date(),
          },
        });

      processed++;
    } catch (err) {
      logger.warn(
        { modelId: model.id, err: err instanceof Error ? err.message : err },
        "Failed to upsert model"
      );
    }
  }

  logger.info({ modelsProcessed: processed, totalModels: models.length }, "Model catalog refresh complete");
  return { modelsProcessed: processed };
}

export function startModelCatalogWorker(): void {
  if (!hasRedisCapability()) {
    logger.info("Model catalog worker not started — no Redis configured");
    return;
  }

  _worker = new Worker(QUEUE_NAME, processModelCatalogRefresh, {
    connection: getConnectionOpts(),
    concurrency: 1,
  });

  _worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Model catalog refresh job completed");
  });

  _worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "Model catalog refresh job failed");
  });

  // Schedule the recurring job
  const queue = getModelCatalogQueue();
  if (queue) {
    const cron = process.env.CATALOG_REFRESH_CRON ?? DEFAULT_CRON;
    void queue.upsertJobScheduler(
      "weekly-model-catalog-refresh",
      { pattern: cron },
      {
        name: "model-catalog-refresh",
        data: { trigger: "scheduled" },
      }
    );
    logger.info({ cron }, "Model catalog refresh scheduled");
  }
}

export async function triggerManualRefresh(): Promise<{ modelsProcessed: number }> {
  const queue = getModelCatalogQueue();
  if (queue) {
    const job = await queue.add("model-catalog-refresh", { trigger: "manual" });
    const queueEvents = new QueueEvents(QUEUE_NAME, { connection: getConnectionOpts() });
    try {
      const result = await job.waitUntilFinished(queueEvents, 30_000);
      return result as { modelsProcessed: number };
    } finally {
      await queueEvents.close();
    }
  }

  // No queue — run inline
  return processModelCatalogRefresh({ id: "manual" } as Job);
}

export async function stopModelCatalogWorker(): Promise<void> {
  if (_worker) {
    await _worker.close();
    _worker = null;
  }
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
}
