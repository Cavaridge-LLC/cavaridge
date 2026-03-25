/**
 * @cavaridge/spaniel — LLM Gateway for the Cavaridge Platform
 *
 * All LLM calls in the platform route through this package.
 * Provides task-based model routing, multi-model consensus,
 * fallback cascading, cost tracking, and audit logging.
 *
 * Usage:
 *   import { chatCompletion, generateEmbedding } from "@cavaridge/spaniel";
 */

// Primary functions
export { chatCompletion } from "./chat.js";
export { chatCompletionStream } from "./stream.js";
export { generateEmbedding } from "./embeddings.js";

// Client factory (for advanced usage / direct OpenRouter access)
export { createSpanielClient, hasAICapability } from "./client.js";

// Types
export type {
  SpanielRequest,
  SpanielResponse,
  SpanielRequestOptions,
  TaskType,
  ConsensusResult,
  ChatMessage,
  TokenUsage,
  CostInfo,
  ModelsUsed,
  ModelTier,
  RoutingEntry,
  EmbeddingOptions,
  RequestLogEntry,
  ModelPricing,
} from "./types.js";

// Routing (for introspection / admin)
export { getRoutingForTask, getDefaultRouting } from "./routing.js";

// Schema (for migrations / Drizzle usage)
export { routingMatrix, requestLog, modelCatalog, spanielSchema } from "./schema.js";

// DB (for direct queries if needed)
export { getDb, hasDbCapability } from "./db.js";

// Redis
export { getRedis, hasRedisCapability, closeRedis } from "./redis.js";

// Langfuse observability
export { getLangfuse, hasLangfuseCapability, traceRequest, flushLangfuse } from "./langfuse.js";

// Stream callbacks
export type { StreamCallbacks } from "./stream.js";

// Cost calculation
export { calculateCost } from "./cost.js";

// Consensus engine
export { runConsensus } from "./consensus.js";

// Fallback cascade
export { withFallback } from "./fallback.js";
export type { FallbackResult } from "./fallback.js";
