/**
 * BlueprintSearch — Semantic search against name/tags/description using pgvector embeddings.
 *
 * Embeddings are generated externally (via Spaniel) and stored in blueprint_embeddings.
 * This module handles storage, retrieval, and similarity queries.
 */

import { eq, and, or, isNull, sql, desc } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { blueprints, blueprintEmbeddings } from "./schema.js";
import type {
  Blueprint,
  BlueprintCategory,
  BlueprintSearchOptions,
  BlueprintSearchResult,
  BuildPlan,
  TemplateFile,
  BlueprintVariable,
} from "./types.js";

// ── Embedding Generator Interface ─────────────────────────────────

/**
 * Function that generates a 1536-dimension embedding vector from text.
 * Consumers provide their own implementation (typically via @cavaridge/spaniel).
 */
export type EmbeddingGenerator = (text: string) => Promise<number[]>;

// ── BlueprintSearch ───────────────────────────────────────────────

export class BlueprintSearch {
  constructor(
    private db: PostgresJsDatabase,
    private generateEmbedding: EmbeddingGenerator
  ) {}

  /**
   * Generate and store an embedding for a blueprint.
   * Call this after creating or updating a blueprint.
   */
  async indexBlueprint(blueprintId: string): Promise<void> {
    // Fetch the blueprint to build the text corpus
    const [bp] = await this.db
      .select()
      .from(blueprints)
      .where(eq(blueprints.id, blueprintId))
      .limit(1);

    if (!bp) {
      throw new Error(`Blueprint not found: ${blueprintId}`);
    }

    const corpus = buildSearchCorpus(bp.name, (bp as Record<string, unknown>).description as string ?? "", bp.tags ?? []);
    const embedding = await this.generateEmbedding(corpus);

    // Upsert: delete existing embedding, then insert
    await this.db
      .delete(blueprintEmbeddings)
      .where(eq(blueprintEmbeddings.blueprintId, blueprintId));

    await this.db.insert(blueprintEmbeddings).values({
      blueprintId,
      embedding,
    });
  }

  /**
   * Semantic search for blueprints matching a natural-language query.
   * Returns results ordered by cosine similarity (highest first).
   */
  async search(options: BlueprintSearchOptions): Promise<BlueprintSearchResult[]> {
    const queryEmbedding = await this.generateEmbedding(options.query);
    const limit = options.limit ?? 10;

    // Build tenant scoping condition
    const tenantConditions = [];
    if (options.tenantId !== undefined) {
      if (options.tenantId === null) {
        tenantConditions.push(isNull(blueprints.tenantId));
      } else {
        tenantConditions.push(
          or(isNull(blueprints.tenantId), eq(blueprints.tenantId, options.tenantId))
        );
      }
    }

    if (options.category) {
      tenantConditions.push(eq(blueprints.category, options.category));
    }

    if (options.tags && options.tags.length > 0) {
      tenantConditions.push(sql`${blueprints.tags} && ${options.tags}`);
    }

    const whereClause = tenantConditions.length > 0 ? and(...tenantConditions) : undefined;

    // Cosine similarity via pgvector: 1 - (embedding <=> query_embedding)
    const similarityExpr = sql<number>`1 - (${blueprintEmbeddings.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`;

    const rows = await this.db
      .select({
        id: blueprints.id,
        name: blueprints.name,
        description: sql<string>`${blueprints.description}`,
        category: blueprints.category,
        buildPlan: blueprints.buildPlan,
        templateCode: blueprints.templateCode,
        variables: blueprints.variables,
        tags: blueprints.tags,
        version: blueprints.version,
        tenantId: blueprints.tenantId,
        usageCount: blueprints.usageCount,
        avgTestScore: blueprints.avgTestScore,
        createdAt: blueprints.createdAt,
        updatedAt: blueprints.updatedAt,
        similarity: similarityExpr,
      })
      .from(blueprintEmbeddings)
      .innerJoin(blueprints, eq(blueprintEmbeddings.blueprintId, blueprints.id))
      .where(whereClause)
      .orderBy(desc(similarityExpr))
      .limit(limit);

    return rows.map((row) => ({
      blueprint: {
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        category: row.category as BlueprintCategory,
        buildPlan: row.buildPlan as unknown as BuildPlan,
        templateCode: row.templateCode as unknown as TemplateFile[],
        variables: row.variables as unknown as BlueprintVariable[],
        tags: row.tags ?? [],
        version: row.version,
        tenantId: row.tenantId,
        usageCount: row.usageCount,
        avgTestScore: row.avgTestScore,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      similarity: row.similarity,
    }));
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function buildSearchCorpus(name: string, description: string, tags: string[]): string {
  return [name, description, ...tags].filter(Boolean).join(" ");
}
