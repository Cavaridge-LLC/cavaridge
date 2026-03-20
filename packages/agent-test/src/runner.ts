/**
 * @cavaridge/agent-test — Legacy Scenario Runner (back-compat)
 *
 * Preserved for existing consumers in tenant-intel and domain-agents.
 * New code should use ScoringEngine directly.
 */

import { ScoringEngine } from "./scoring-engine.js";
import type { TestScenario, TestResult, TestSuiteResult, ScenarioExecutor } from "./types.js";

const engine = new ScoringEngine();

/**
 * @deprecated Use `new ScoringEngine().runScenario()` instead.
 */
export async function runScenario(
  scenario: TestScenario,
  executor: ScenarioExecutor,
): Promise<TestResult> {
  return engine.runScenario(scenario, executor);
}

/**
 * @deprecated Use `new ScoringEngine().runSuite()` instead.
 */
export async function runSuite(
  suiteName: string,
  scenarios: TestScenario[],
  executor: ScenarioExecutor,
): Promise<TestSuiteResult> {
  return engine.runSuite(suiteName, scenarios, executor);
}
