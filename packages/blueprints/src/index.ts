/**
 * @cavaridge/blueprints — Reusable build template library.
 *
 * Provides versioned, tenant-scoped build templates with full BuildPlan objects,
 * scaffolded source files, configurable parameters, semantic search via pgvector,
 * and MSP-scoped forking.
 */

// Schema
export {
  blueprints,
  blueprintEmbeddings,
  blueprintCategoryEnum,
  type BlueprintRow,
  type NewBlueprintRow,
  type BlueprintEmbeddingRow,
  type NewBlueprintEmbeddingRow,
} from "./schema.js";

// Types
export type {
  BlueprintCategory,
  BuildPlan,
  BuildPlanAgentNode,
  BuildPlanToolDef,
  BuildPlanSchema,
  BuildPlanSchemaField,
  BuildPlanUIWireframe,
  BuildPlanRBACRule,
  BuildPlanTestScenario,
  BlueprintVariable,
  TemplateFile,
  Blueprint,
  NewBlueprint,
  BlueprintForkOptions,
  BlueprintSearchOptions,
  BlueprintSearchResult,
} from "./types.js";

// Registry
export { BlueprintRegistry, type BlueprintListOptions, type VersionBump } from "./registry.js";

// Search
export { BlueprintSearch, type EmbeddingGenerator } from "./search.js";

// Fork
export { BlueprintFork } from "./fork.js";

// Seeds
export { SEED_BLUEPRINTS, seedBlueprints } from "./seeds.js";
