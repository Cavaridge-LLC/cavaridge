/**
 * Meridian Embedding Agent Adapter
 *
 * Thin wrapper around Spaniel's embedding functionality.
 * Embeddings are not agents but are included here for consistency.
 */

import {
  generateEmbedding,
  hasAICapability,
} from "@cavaridge/spaniel";

/**
 * Generate a single embedding vector.
 */
export async function generateSingleEmbedding(text: string): Promise<number[] | null> {
  if (!hasAICapability()) return null;

  const embeddings = await generateEmbedding(text, {
    tenantId: "system",
    userId: "system",
    appCode: "CVG-MER",
  });

  return embeddings[0] ?? null;
}

/**
 * Generate embeddings for a batch of texts.
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][] | null> {
  if (!hasAICapability()) return null;

  return generateEmbedding(texts, {
    tenantId: "system",
    userId: "system",
    appCode: "CVG-MER",
  });
}

export { hasAICapability };
