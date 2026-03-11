/**
 * RAG utilities — text chunking, cosine similarity, and retrieval
 */
import { db } from "./db";
import { knowledgeChunks, knowledgeSources } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { generateEmbedding } from "./openrouter";
import { logger } from "./logger";

// ── Text Chunking ──────────────────────────────────────────────────────

const CHUNK_SIZE = 800; // tokens ≈ chars * 0.75, so ~600 tokens per chunk
const CHUNK_OVERLAP = 100;

export function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length <= chunkSize) return [cleaned];

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + chunkSize;

    if (end < cleaned.length) {
      // Try to break at paragraph, then sentence, then word boundary
      const slice = cleaned.slice(start, end);
      const paraBreak = slice.lastIndexOf("\n\n");
      const sentenceBreak = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("! "),
      );
      const wordBreak = slice.lastIndexOf(" ");

      if (paraBreak > chunkSize * 0.5) {
        end = start + paraBreak + 2;
      } else if (sentenceBreak > chunkSize * 0.3) {
        end = start + sentenceBreak + 2;
      } else if (wordBreak > 0) {
        end = start + wordBreak + 1;
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start = end - overlap;
    if (start >= cleaned.length) break;
  }

  return chunks;
}

// ── Cosine Similarity ─────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// ── Ingest Content ────────────────────────────────────────────────────

export async function ingestContent(
  sourceId: string,
  tenantId: string,
  content: string,
): Promise<number> {
  const chunks = chunkText(content);
  if (chunks.length === 0) return 0;

  // Generate embeddings in batches of 20
  const batchSize = 20;
  let totalInserted = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    try {
      const embeddings = await generateEmbedding(batch);

      const values = batch.map((chunk, j) => ({
        sourceId,
        tenantId,
        content: chunk,
        embeddingJson: embeddings[j],
        chunkIndex: i + j,
      }));

      await db.insert(knowledgeChunks).values(values);
      totalInserted += batch.length;
    } catch (err) {
      logger.error({ err, sourceId, batchStart: i }, "Failed to embed chunk batch");
    }
  }

  return totalInserted;
}

// ── Retrieve Relevant Chunks ──────────────────────────────────────────

export interface RetrievedChunk {
  content: string;
  sourceName: string;
  sourceType: string;
  score: number;
}

export async function retrieveRelevantChunks(
  query: string,
  tenantId: string,
  topK = 5,
  minScore = 0.3,
): Promise<RetrievedChunk[]> {
  // Generate query embedding
  const [queryEmbedding] = await generateEmbedding(query);
  if (!queryEmbedding || queryEmbedding.length === 0) return [];

  // Fetch all active chunks for tenant (for small-medium knowledge bases)
  // For production scale, migrate to pgvector
  const allChunks = await db
    .select({
      content: knowledgeChunks.content,
      embeddingJson: knowledgeChunks.embeddingJson,
      sourceName: knowledgeSources.name,
      sourceType: knowledgeSources.sourceType,
    })
    .from(knowledgeChunks)
    .innerJoin(knowledgeSources, eq(knowledgeChunks.sourceId, knowledgeSources.id))
    .where(
      and(
        eq(knowledgeChunks.tenantId, tenantId),
        eq(knowledgeSources.isActive, true),
      ),
    );

  // Score and rank
  const scored = allChunks
    .filter((c) => c.embeddingJson && Array.isArray(c.embeddingJson))
    .map((c) => ({
      content: c.content,
      sourceName: c.sourceName,
      sourceType: c.sourceType,
      score: cosineSimilarity(queryEmbedding, c.embeddingJson as number[]),
    }))
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

// ── Fetch URL Content ─────────────────────────────────────────────────

export async function fetchUrlContent(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "CVG-DUCKY/1.0 (knowledge-ingestion)" },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  // Strip HTML tags for basic extraction
  if (contentType.includes("text/html")) {
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  return text;
}
