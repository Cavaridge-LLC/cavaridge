import {
  hasAICapability,
  generateEmbedding as spanielEmbed,
} from "@cavaridge/spaniel";
import { db } from "./db";
import { documentChunks, documents } from "@shared/schema";
import { eq, and, isNull, sql, ilike, or } from "drizzle-orm";

const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 20;
const RATE_LIMIT_DELAY_MS = 350;

let vectorSupportReady = false;

async function ensureVectorSupport(): Promise<void> {
  if (vectorSupportReady) return;
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    const colCheck = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'document_chunks' AND column_name = 'embedding'
    `);
    const rows = Array.isArray(colCheck) ? colCheck : (colCheck as any)?.rows || [];
    if (rows.length === 0) {
      await db.execute(sql`ALTER TABLE document_chunks ADD COLUMN embedding vector(1536)`);
      console.log("Added embedding column to document_chunks");
    }
    vectorSupportReady = true;
  } catch (err: any) {
    console.error("Could not set up vector support:", err.message);
    throw new Error("Vector support not available: " + err.message);
  }
}

function generateSearchTokens(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const unique = Array.from(new Set(words));
  return unique.join(" ");
}

export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][] | null> {
  if (!hasAICapability()) return null;

  return spanielEmbed(texts, {
    tenantId: "system",
    userId: "system",
    appCode: "CVG-MER",
  });
}

export async function generateSingleEmbedding(
  text: string
): Promise<number[] | null> {
  if (!hasAICapability()) return null;

  const result = await spanielEmbed(text, {
    tenantId: "system",
    userId: "system",
    appCode: "CVG-MER",
  });

  return result[0] || null;
}

interface EmbeddingProgress {
  total: number;
  completed: number;
  failed: number;
  status: "idle" | "running" | "completed" | "error";
  message: string;
}

const progressMap = new Map<string, EmbeddingProgress>();

export function getEmbeddingProgress(dealId: string): EmbeddingProgress {
  return progressMap.get(dealId) || {
    total: 0,
    completed: 0,
    failed: 0,
    status: "idle",
    message: "",
  };
}

export async function embedChunksForDeal(dealId: string): Promise<EmbeddingProgress> {
  const existing = progressMap.get(dealId);
  if (existing?.status === "running") {
    return existing;
  }

  await ensureVectorSupport();

  const unembeddedChunks = await db
    .select({
      id: documentChunks.id,
      chunkText: documentChunks.chunkText,
      documentId: documentChunks.documentId,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .where(
      and(
        eq(documentChunks.dealId, dealId),
        eq(documents.extractionStatus, "extracted"),
        sql`${documentChunks}.embedding IS NULL`
      )
    );

  if (unembeddedChunks.length === 0) {
    const progress: EmbeddingProgress = {
      total: 0,
      completed: 0,
      failed: 0,
      status: "completed",
      message: "All chunks already have embeddings",
    };
    progressMap.set(dealId, progress);
    return progress;
  }

  const progress: EmbeddingProgress = {
    total: unembeddedChunks.length,
    completed: 0,
    failed: 0,
    status: "running",
    message: `Embedding chunks: 0 of ${unembeddedChunks.length} complete`,
  };
  progressMap.set(dealId, progress);

  const useAI = hasAICapability();

  (async () => {
    try {
      for (let i = 0; i < unembeddedChunks.length; i += BATCH_SIZE) {
        const batch = unembeddedChunks.slice(i, i + BATCH_SIZE);
        const texts = batch.map((c) => c.chunkText);

        if (useAI) {
          try {
            const embeddings = await generateEmbeddingsBatch(texts);
            if (embeddings) {
              for (let j = 0; j < batch.length; j++) {
                const vecStr = `[${embeddings[j].join(",")}]`;
                await db.execute(
                  sql`UPDATE document_chunks SET embedding = ${vecStr}::vector, search_tokens = to_tsvector('english', ${texts[j]}) WHERE id = ${batch[j].id}`
                );
              }
              progress.completed += batch.length;
            } else {
              for (const chunk of batch) {
                const tokens = generateSearchTokens(chunk.chunkText);
                await db.execute(
                  sql`UPDATE document_chunks SET search_tokens = to_tsvector('english', ${chunk.chunkText}) WHERE id = ${chunk.id}`
                );
              }
              progress.completed += batch.length;
            }
          } catch (err: any) {
            console.error("Embedding batch error:", err.message);
            for (const chunk of batch) {
              await db.execute(
                sql`UPDATE document_chunks SET search_tokens = to_tsvector('english', ${chunk.chunkText}) WHERE id = ${chunk.id}`
              );
            }
            progress.completed += batch.length;
            progress.failed += batch.length;
          }

          if (i + BATCH_SIZE < unembeddedChunks.length) {
            await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
          }
        } else {
          for (const chunk of batch) {
            await db.execute(
              sql`UPDATE document_chunks SET search_tokens = to_tsvector('english', ${chunk.chunkText}) WHERE id = ${chunk.id}`
            );
          }
          progress.completed += batch.length;
        }

        progress.message = `Embedding chunks: ${progress.completed} of ${progress.total} complete`;
        progressMap.set(dealId, { ...progress });
      }

      progress.status = "completed";
      progress.message = `Done: ${progress.completed} chunks embedded${progress.failed > 0 ? ` (${progress.failed} fell back to text search)` : ""}`;
      progressMap.set(dealId, { ...progress });
    } catch (err: any) {
      console.error("Embedding pipeline error:", err.message);
      progress.status = "error";
      progress.message = `Error: ${err.message}`;
      progressMap.set(dealId, { ...progress });
    }
  })();

  return progress;
}

export interface SearchResult {
  chunkText: string;
  documentId: string;
  chunkIndex: number;
  similarity: number;
  filename: string;
  classification: string | null;
}

export async function semanticSearch(
  dealId: string,
  query: string,
  topK: number = 10
): Promise<SearchResult[]> {
  await ensureVectorSupport();
  if (hasAICapability()) {
    const queryEmbedding = await generateSingleEmbedding(query);
    if (queryEmbedding) {
      const vecStr = `[${queryEmbedding.join(",")}]`;
      const results = await db.execute(
        sql`SELECT dc.chunk_text, dc.document_id, dc.chunk_index,
                   1 - (dc.embedding <=> ${vecStr}::vector) as similarity,
                   d.filename, d.classification
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE dc.deal_id = ${dealId}
              AND dc.embedding IS NOT NULL
            ORDER BY dc.embedding <=> ${vecStr}::vector
            LIMIT ${topK}`
      );

      if (results.rows && results.rows.length > 0) {
        return results.rows.map((r: any) => ({
          chunkText: r.chunk_text,
          documentId: r.document_id,
          chunkIndex: r.chunk_index,
          similarity: parseFloat(r.similarity),
          filename: r.filename,
          classification: r.classification,
        }));
      }
    }
  }

  return fullTextSearch(dealId, query, topK);
}

async function fullTextSearch(
  dealId: string,
  query: string,
  topK: number
): Promise<SearchResult[]> {
  const tsQuery = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .join(" & ");

  if (!tsQuery) return [];

  const results = await db.execute(
    sql`SELECT dc.chunk_text, dc.document_id, dc.chunk_index,
               ts_rank(dc.search_tokens, to_tsquery('english', ${tsQuery})) as similarity,
               d.filename, d.classification
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE dc.deal_id = ${dealId}
          AND dc.search_tokens @@ to_tsquery('english', ${tsQuery})
        ORDER BY similarity DESC
        LIMIT ${topK}`
  );

  if (results.rows && results.rows.length > 0) {
    return results.rows.map((r: any) => ({
      chunkText: r.chunk_text,
      documentId: r.document_id,
      chunkIndex: r.chunk_index,
      similarity: Math.min(1, parseFloat(r.similarity)),
      filename: r.filename,
      classification: r.classification,
    }));
  }

  return keywordFallback(dealId, query, topK);
}

async function keywordFallback(
  dealId: string,
  query: string,
  topK: number
): Promise<SearchResult[]> {
  const keywords = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (keywords.length === 0) return [];

  const likeConditions = keywords.map((kw) => ilike(documentChunks.chunkText, `%${kw}%`));

  const results = await db
    .select({
      chunkText: documentChunks.chunkText,
      documentId: documentChunks.documentId,
      chunkIndex: documentChunks.chunkIndex,
      filename: documents.filename,
      classification: documents.classification,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .where(and(eq(documentChunks.dealId, dealId), or(...likeConditions)))
    .limit(topK);

  if (results.length > 0) {
    return results.map((r) => ({
      chunkText: r.chunkText,
      documentId: r.documentId || "",
      chunkIndex: r.chunkIndex,
      similarity: 0.5,
      filename: r.filename,
      classification: r.classification,
    }));
  }

  return [];
}
