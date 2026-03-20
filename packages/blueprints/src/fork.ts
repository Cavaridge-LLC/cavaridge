/**
 * BlueprintFork — Copy a platform-level blueprint into an MSP-scoped library
 * with variable customization.
 */

import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { blueprints } from "./schema.js";
import { BlueprintRegistry } from "./registry.js";
import type { BlueprintSearch, EmbeddingGenerator } from "./search.js";
import type {
  Blueprint,
  BlueprintForkOptions,
  BlueprintVariable,
} from "./types.js";

export class BlueprintFork {
  private registry: BlueprintRegistry;

  constructor(
    private db: PostgresJsDatabase,
    private search?: BlueprintSearch
  ) {
    this.registry = new BlueprintRegistry(db);
  }

  /**
   * Fork a blueprint into an MSP-scoped copy.
   *
   * - Copies all fields from the source blueprint
   * - Sets tenant_id to the target MSP tenant
   * - Applies variable overrides (updates default values)
   * - Resets usage_count and avg_test_score
   * - Reindexes for semantic search if BlueprintSearch is provided
   */
  async fork(options: BlueprintForkOptions): Promise<Blueprint> {
    const source = await this.registry.getById(options.sourceBlueprintId);
    if (!source) {
      throw new Error(`Source blueprint not found: ${options.sourceBlueprintId}`);
    }

    // Apply variable overrides
    const variables = applyVariableOverrides(
      source.variables,
      options.variableOverrides ?? {}
    );

    const forked = await this.registry.create({
      name: options.name ?? `${source.name} (Fork)`,
      description: source.description,
      category: source.category,
      buildPlan: source.buildPlan,
      templateCode: source.templateCode,
      variables,
      tags: [...source.tags, ...(options.additionalTags ?? [])],
      version: "1.0.0",
      tenantId: options.targetTenantId,
    });

    // Index the forked blueprint for semantic search
    if (this.search) {
      await this.search.indexBlueprint(forked.id);
    }

    return forked;
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function applyVariableOverrides(
  variables: BlueprintVariable[],
  overrides: Record<string, unknown>
): BlueprintVariable[] {
  return variables.map((v) => {
    if (v.key in overrides) {
      return { ...v, defaultValue: overrides[v.key] };
    }
    return v;
  });
}
