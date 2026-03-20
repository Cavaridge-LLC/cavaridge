/**
 * BlueprintRegistry — CRUD operations and version management for blueprints.
 *
 * All queries are tenant-scoped: platform-level blueprints (tenant_id IS NULL)
 * are visible to all tenants, MSP-scoped blueprints only to their owner.
 */

import { eq, and, or, isNull, sql, desc, asc, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { blueprints, type BlueprintRow, type NewBlueprintRow } from "./schema.js";
import type {
  Blueprint,
  NewBlueprint,
  BlueprintCategory,
  BuildPlan,
  TemplateFile,
  BlueprintVariable,
} from "./types.js";

// ── Row ↔ Domain Mapping ──────────────────────────────────────────

function rowToBlueprint(row: BlueprintRow): Blueprint {
  return {
    id: row.id,
    name: row.name,
    description: (row as Record<string, unknown>).description as string ?? "",
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
  };
}

// ── Version Helpers ───────────────────────────────────────────────

export type VersionBump = "major" | "minor" | "patch";

function bumpVersion(current: string, bump: VersionBump): string {
  const parts = current.split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return "1.0.0";
  }
  switch (bump) {
    case "major":
      return `${parts[0] + 1}.0.0`;
    case "minor":
      return `${parts[0]}.${parts[1] + 1}.0`;
    case "patch":
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
}

// ── List Options ──────────────────────────────────────────────────

export interface BlueprintListOptions {
  tenantId?: string | null;
  category?: BlueprintCategory;
  tags?: string[];
  limit?: number;
  offset?: number;
  orderBy?: "name" | "usage_count" | "avg_test_score" | "created_at" | "updated_at";
  orderDir?: "asc" | "desc";
}

// ── BlueprintRegistry ─────────────────────────────────────────────

export class BlueprintRegistry {
  constructor(private db: PostgresJsDatabase) {}

  /** Create a new blueprint. */
  async create(input: NewBlueprint): Promise<Blueprint> {
    const row: NewBlueprintRow = {
      name: input.name,
      description: input.description,
      category: input.category,
      buildPlan: input.buildPlan as unknown as Record<string, unknown>,
      templateCode: input.templateCode as unknown as unknown[],
      variables: input.variables as unknown as unknown[],
      tags: input.tags,
      version: input.version ?? "1.0.0",
      tenantId: input.tenantId,
    };

    const [inserted] = await this.db.insert(blueprints).values(row).returning();
    return rowToBlueprint(inserted);
  }

  /** Get a blueprint by ID. Returns null if not found. */
  async getById(id: string): Promise<Blueprint | null> {
    const [row] = await this.db
      .select()
      .from(blueprints)
      .where(eq(blueprints.id, id))
      .limit(1);
    return row ? rowToBlueprint(row) : null;
  }

  /**
   * List blueprints visible to a tenant.
   * Includes platform-level (tenant_id IS NULL) + the tenant's own blueprints.
   */
  async list(options: BlueprintListOptions = {}): Promise<Blueprint[]> {
    const conditions = [];

    // Tenant scoping: platform-level + owned
    if (options.tenantId !== undefined) {
      if (options.tenantId === null) {
        conditions.push(isNull(blueprints.tenantId));
      } else {
        conditions.push(
          or(isNull(blueprints.tenantId), eq(blueprints.tenantId, options.tenantId))
        );
      }
    }

    if (options.category) {
      conditions.push(eq(blueprints.category, options.category));
    }

    if (options.tags && options.tags.length > 0) {
      conditions.push(sql`${blueprints.tags} && ${options.tags}`);
    }

    const orderCol = {
      name: blueprints.name,
      usage_count: blueprints.usageCount,
      avg_test_score: blueprints.avgTestScore,
      created_at: blueprints.createdAt,
      updated_at: blueprints.updatedAt,
    }[options.orderBy ?? "created_at"] ?? blueprints.createdAt;

    const orderFn = options.orderDir === "asc" ? asc : desc;

    const rows = await this.db
      .select()
      .from(blueprints)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderFn(orderCol))
      .limit(options.limit ?? 50)
      .offset(options.offset ?? 0);

    return rows.map(rowToBlueprint);
  }

  /** Update a blueprint's mutable fields. */
  async update(
    id: string,
    updates: Partial<Pick<Blueprint, "name" | "description" | "category" | "buildPlan" | "templateCode" | "variables" | "tags">>
  ): Promise<Blueprint | null> {
    const setClause: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (updates.name !== undefined) setClause.name = updates.name;
    if (updates.description !== undefined) setClause.description = updates.description;
    if (updates.category !== undefined) setClause.category = updates.category;
    if (updates.buildPlan !== undefined) setClause.buildPlan = updates.buildPlan;
    if (updates.templateCode !== undefined) setClause.templateCode = updates.templateCode;
    if (updates.variables !== undefined) setClause.variables = updates.variables;
    if (updates.tags !== undefined) setClause.tags = updates.tags;

    const [row] = await this.db
      .update(blueprints)
      .set(setClause)
      .where(eq(blueprints.id, id))
      .returning();

    return row ? rowToBlueprint(row) : null;
  }

  /** Delete a blueprint by ID. Returns true if deleted. */
  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(blueprints)
      .where(eq(blueprints.id, id))
      .returning({ id: blueprints.id });
    return result.length > 0;
  }

  /** Bump version and return updated blueprint. */
  async bumpVersion(id: string, bump: VersionBump): Promise<Blueprint | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const newVersion = bumpVersion(existing.version, bump);

    const [row] = await this.db
      .update(blueprints)
      .set({ version: newVersion, updatedAt: new Date() })
      .where(eq(blueprints.id, id))
      .returning();

    return row ? rowToBlueprint(row) : null;
  }

  /** Increment usage_count by 1. */
  async incrementUsage(id: string): Promise<void> {
    await this.db
      .update(blueprints)
      .set({
        usageCount: sql`${blueprints.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(blueprints.id, id));
  }

  /** Update avg_test_score from a new simulation result. */
  async updateTestScore(id: string, newScore: number): Promise<void> {
    // Weighted running average: ((old * count) + new) / (count + 1)
    await this.db
      .update(blueprints)
      .set({
        avgTestScore: sql`
          CASE
            WHEN ${blueprints.avgTestScore} IS NULL THEN ${newScore}
            ELSE (${blueprints.avgTestScore} * ${blueprints.usageCount} + ${newScore})
                 / (${blueprints.usageCount} + 1)
          END
        `,
        updatedAt: new Date(),
      })
      .where(eq(blueprints.id, id));
  }
}
