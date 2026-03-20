/**
 * @cavaridge/blueprints — Core type definitions for the reusable build template library.
 *
 * Blueprints store versioned, tenant-scoped build templates with full BuildPlan
 * objects, scaffolded source files, and configurable parameters.
 */

// ── Blueprint Category ────────────────────────────────────────────

export type BlueprintCategory =
  | "agent"
  | "app"
  | "component"
  | "workflow"
  | "integration";

// ── BuildPlan (stored as JSONB) ───────────────────────────────────

export interface BuildPlanAgentNode {
  agentId: string;
  layer: 1 | 2 | 3;
  domainId?: string;
  description: string;
  inputs: string[];
  outputs: string[];
}

export interface BuildPlanToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface BuildPlanSchemaField {
  name: string;
  type: string;
  nullable?: boolean;
  defaultValue?: unknown;
  references?: string;
}

export interface BuildPlanSchema {
  tableName: string;
  fields: BuildPlanSchemaField[];
  indexes?: string[];
  rls: boolean;
}

export interface BuildPlanUIWireframe {
  route: string;
  component: string;
  description: string;
  layout?: string;
}

export interface BuildPlanRBACRule {
  role: string;
  resource: string;
  actions: string[];
}

export interface BuildPlanTestScenario {
  name: string;
  category: string;
  input: Record<string, unknown>;
  expectedOutcome: "pass" | "degrade" | "fail";
}

export interface BuildPlan {
  name: string;
  description: string;
  agentGraph: BuildPlanAgentNode[];
  tools: BuildPlanToolDef[];
  schemas: BuildPlanSchema[];
  uiWireframes: BuildPlanUIWireframe[];
  rbacMatrix: BuildPlanRBACRule[];
  testScenarios: BuildPlanTestScenario[];
}

// ── Template Variable ─────────────────────────────────────────────

export interface BlueprintVariable {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select" | "json";
  defaultValue?: unknown;
  options?: string[];
  required: boolean;
  description?: string;
}

// ── Template Code File ────────────────────────────────────────────

export interface TemplateFile {
  path: string;
  content: string;
  /** Placeholder tokens that get replaced during instantiation, e.g. {{TENANT_NAME}} */
  placeholders?: string[];
}

// ── Blueprint (full domain object) ────────────────────────────────

export interface Blueprint {
  id: string;
  name: string;
  description: string;
  category: BlueprintCategory;
  buildPlan: BuildPlan;
  templateCode: TemplateFile[];
  variables: BlueprintVariable[];
  tags: string[];
  version: string;
  tenantId: string | null;
  usageCount: number;
  avgTestScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewBlueprint = Omit<Blueprint, "id" | "usageCount" | "avgTestScore" | "createdAt" | "updatedAt">;

// ── Fork Options ──────────────────────────────────────────────────

export interface BlueprintForkOptions {
  /** Source blueprint ID to fork from */
  sourceBlueprintId: string;
  /** Target MSP tenant ID */
  targetTenantId: string;
  /** Variable overrides for the forked copy */
  variableOverrides?: Record<string, unknown>;
  /** Optional new name (defaults to "{original} (Fork)") */
  name?: string;
  /** Optional new tags to add */
  additionalTags?: string[];
}

// ── Search Options ────────────────────────────────────────────────

export interface BlueprintSearchOptions {
  query: string;
  category?: BlueprintCategory;
  tags?: string[];
  tenantId?: string | null;
  limit?: number;
}

export interface BlueprintSearchResult {
  blueprint: Blueprint;
  similarity: number;
}
