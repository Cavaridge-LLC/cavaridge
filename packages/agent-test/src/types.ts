/**
 * @cavaridge/agent-test — Core type definitions for agent simulation testing.
 *
 * Automated adversarial testing with persona generation mapped to UTM/RBAC,
 * domain-specific scenario batteries, pass/degrade/fail scoring.
 */

export type AssertionType =
  | "contains"
  | "not_contains"
  | "matches_role"
  | "tenant_isolation"
  | "risk_score_range"
  | "status_code"
  | "json_path_equals";

export interface TestAssertion {
  type: AssertionType;
  /** Target field path (e.g., "result.guidance", "response.statusCode") */
  field?: string;
  /** Expected value or pattern */
  value: unknown;
  /** Human-readable description of what this assertion checks */
  description: string;
}

export interface TestPersona {
  role: string;
  tenantId: string;
  tenantType: "platform" | "msp" | "client" | "site" | "prospect";
  userId: string;
}

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  /** Which agent this scenario tests */
  agentId: string;
  /** Category of test */
  category: "security" | "functional" | "rbac" | "phi_boundary" | "tenant_isolation";
  /** Persona performing the action */
  persona: TestPersona;
  /** Input data for the agent or API endpoint */
  input: Record<string, unknown>;
  /** Assertions to evaluate */
  assertions: TestAssertion[];
  /** Expected result: pass, degrade (partial), or fail */
  expectedOutcome: "pass" | "degrade" | "fail";
}

export interface TestResult {
  scenarioId: string;
  scenarioName: string;
  passed: boolean;
  /** 0-100 score (100 = all assertions passed) */
  score: number;
  /** Per-assertion results */
  assertionResults: Array<{
    assertion: TestAssertion;
    passed: boolean;
    actual?: unknown;
    message?: string;
  }>;
  executionTimeMs: number;
  error?: string;
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
