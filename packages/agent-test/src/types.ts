/**
 * @cavaridge/agent-test — Core type definitions for agent simulation testing.
 *
 * Automated adversarial testing with persona generation mapped to UTM/RBAC,
 * domain-specific scenario batteries, pass/degrade/fail scoring, canary gate
 * enforcement, Langfuse tracing, and BullMQ job execution.
 */

// ── UTM / RBAC ──────────────────────────────────────────────────────

export type TenantType = "platform" | "msp" | "client" | "site" | "prospect";

export type RbacRole =
  | "platform_admin"
  | "msp_admin"
  | "msp_tech"
  | "client_admin"
  | "client_viewer"
  | "prospect";

// ── Assertion Types ─────────────────────────────────────────────────

export type AssertionType =
  | "contains"
  | "not_contains"
  | "matches_role"
  | "tenant_isolation"
  | "risk_score_range"
  | "status_code"
  | "json_path_equals"
  | "regex_match"
  | "response_time_ms";

export interface TestAssertion {
  type: AssertionType;
  /** Target field path (e.g., "result.guidance", "response.statusCode") */
  field?: string;
  /** Expected value or pattern */
  value: unknown;
  /** Human-readable description of what this assertion checks */
  description: string;
}

// ── Scenario Category ───────────────────────────────────────────────

export type ScenarioCategory =
  | "security"
  | "functional"
  | "rbac"
  | "phi_boundary"
  | "tenant_isolation";

// ── Test Persona ────────────────────────────────────────────────────

export interface TestPersona {
  role: RbacRole;
  tenantId: string;
  tenantType: TenantType;
  userId: string;
  /** Human-readable label for reporting */
  displayName?: string;
  /** Parent tenant ID (for client/site personas under an MSP) */
  parentTenantId?: string;
}

// ── Test Scenario ───────────────────────────────────────────────────

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  /** Which agent this scenario tests */
  agentId: string;
  /** Category of test */
  category: ScenarioCategory;
  /** Persona performing the action */
  persona: TestPersona;
  /** Input data for the agent or API endpoint */
  input: Record<string, unknown>;
  /** Assertions to evaluate */
  assertions: TestAssertion[];
  /** Expected result: pass, degrade (partial), or fail */
  expectedOutcome: "pass" | "degrade" | "fail";
  /** Optional tags for filtering */
  tags?: string[];
  /** Max execution time in ms before timeout */
  timeoutMs?: number;
}

// ── Test Results ────────────────────────────────────────────────────

export type TestOutcome = "pass" | "degrade" | "fail";

export interface AssertionResult {
  assertion: TestAssertion;
  passed: boolean;
  actual?: unknown;
  message?: string;
}

export interface TestResult {
  scenarioId: string;
  scenarioName: string;
  outcome: TestOutcome;
  /** 0-100 score (100 = all assertions passed) */
  score: number;
  /** Per-assertion results */
  assertionResults: AssertionResult[];
  executionTimeMs: number;
  error?: string;
  /** Back-compat: true when outcome === "pass" */
  passed: boolean;
}

export interface TestSuiteResult {
  suiteName: string;
  totalScenarios: number;
  passed: number;
  failed: number;
  degraded: number;
  overallScore: number;
  results: TestResult[];
  executionTimeMs: number;
}

// ── Canary Gate ─────────────────────────────────────────────────────

export interface CanaryGateThresholds {
  /** Security scenarios must pass at this rate (default 1.0 = 100%) */
  securityPassRate: number;
  /** Functional scenarios must pass at this rate (default 0.95 = 95%) */
  functionalPassRate: number;
  /** PHI/PII boundary tests: maximum allowed fail count (default 0) */
  phiBoundaryMaxFails: number;
  /** Tenant isolation tests: maximum allowed fail count (default 0) */
  tenantIsolationMaxFails: number;
}

export type CanaryStage = "canary_10" | "canary_50" | "canary_100";

export interface CanaryGateResult {
  agentVersion: string;
  stage: CanaryStage;
  promoted: boolean;
  /** Which gate blocked promotion, if any */
  blockedBy?: string;
  thresholds: CanaryGateThresholds;
  actual: {
    securityPassRate: number;
    functionalPassRate: number;
    phiBoundaryFails: number;
    tenantIsolationFails: number;
  };
  suiteResult: TestSuiteResult;
  evaluatedAt: string;
}

// ── Langfuse Trace Metadata ─────────────────────────────────────────

export interface LangfuseTraceConfig {
  /** Langfuse public key */
  publicKey: string;
  /** Langfuse secret key */
  secretKey: string;
  /** Langfuse base URL (default: https://cloud.langfuse.com) */
  baseUrl?: string;
  /** Whether tracing is enabled (default: true) */
  enabled?: boolean;
}

export interface TraceMetadata {
  testRunId: string;
  agentVersion: string;
  scenarioId: string;
  category: ScenarioCategory;
  outcome: TestOutcome;
  score: number;
  executionTimeMs: number;
}

// ── BullMQ Job Types ────────────────────────────────────────────────

export interface TestSuiteJobData {
  testRunId: string;
  suiteName: string;
  agentVersion: string;
  /** Path to YAML scenario file or array of scenario IDs */
  scenarioSource: string | string[];
  /** Executor function name (resolved at runtime) */
  executorName: string;
  /** Langfuse config (optional — tracing disabled if absent) */
  langfuseConfig?: LangfuseTraceConfig;
}

export interface TestSuiteJobResult {
  testRunId: string;
  suiteResult: TestSuiteResult;
  canaryGateResult?: CanaryGateResult;
  tracedToLangfuse: boolean;
}

// ── Persona Generator Config ────────────────────────────────────────

export interface PersonaGeneratorConfig {
  /** Platform-level tenant ID (Cavaridge) */
  platformTenantId?: string;
  /** Default MSP tenant ID for generated personas */
  mspTenantId?: string;
  /** Default client tenant ID */
  clientTenantId?: string;
  /** Default site tenant ID */
  siteTenantId?: string;
  /** Prefix for generated user IDs */
  userIdPrefix?: string;
}

// ── Scenario Executor ───────────────────────────────────────────────

export type ScenarioExecutor = (scenario: TestScenario) => Promise<unknown>;
