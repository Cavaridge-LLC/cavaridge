// @cavaridge/agent-test — Automated Agent Simulation Engine
//
// Exports: TestRunner, ScenarioLoader, PersonaGenerator, ScoringEngine,
// CanaryGate, LangfuseTracer, and all types.

// ── Core classes ────────────────────────────────────────────────────
export { TestRunner } from "./test-runner.js";
export type { TestRunnerConfig } from "./test-runner.js";
export { ScenarioLoader } from "./scenario-loader.js";
export { PersonaGenerator } from "./persona-generator.js";
export { ScoringEngine } from "./scoring-engine.js";
export { CanaryGate } from "./canary-gate.js";
export { LangfuseTracer } from "./langfuse-tracer.js";

// ── Legacy runner (back-compat) ─────────────────────────────────────
export { runScenario, runSuite } from "./runner.js";

// ── Types ───────────────────────────────────────────────────────────
export type {
  // UTM / RBAC
  TenantType,
  RbacRole,
  // Assertions
  AssertionType,
  TestAssertion,
  // Scenarios
  ScenarioCategory,
  TestPersona,
  TestScenario,
  ScenarioExecutor,
  // Results
  TestOutcome,
  AssertionResult,
  TestResult,
  TestSuiteResult,
  // Canary gate
  CanaryGateThresholds,
  CanaryStage,
  CanaryGateResult,
  // Langfuse
  LangfuseTraceConfig,
  TraceMetadata,
  // BullMQ jobs
  TestSuiteJobData,
  TestSuiteJobResult,
  // Persona generator
  PersonaGeneratorConfig,
} from "./types.js";
