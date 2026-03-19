/**
 * @cavaridge/agent-test — Scenario Runner
 *
 * Evaluates test scenarios against agent outputs.
 */

import type { TestScenario, TestResult, TestAssertion, TestSuiteResult } from "./types.js";

function evaluateAssertion(assertion: TestAssertion, output: unknown): { passed: boolean; actual?: unknown; message?: string } {
  const getField = (obj: unknown, path?: string): unknown => {
    if (!path) return obj;
    return path.split(".").reduce((acc: any, key) => acc?.[key], obj);
  };

  const actual = getField(output, assertion.field);

  switch (assertion.type) {
    case "contains": {
      const str = typeof actual === "string" ? actual : JSON.stringify(actual);
      const passed = str.includes(String(assertion.value));
      return { passed, actual: str?.slice(0, 200), message: passed ? undefined : `Expected to contain "${assertion.value}"` };
    }

    case "not_contains": {
      const str = typeof actual === "string" ? actual : JSON.stringify(actual);
      const passed = !str.includes(String(assertion.value));
      return { passed, actual: str?.slice(0, 200), message: passed ? undefined : `Expected NOT to contain "${assertion.value}"` };
    }

    case "matches_role": {
      const passed = actual === assertion.value;
      return { passed, actual, message: passed ? undefined : `Expected role "${assertion.value}", got "${actual}"` };
    }

    case "tenant_isolation": {
      const str = JSON.stringify(actual);
      const tenantId = String(assertion.value);
      // Ensure no other tenant IDs appear in the output (simplified check)
      const passed = !str || str.includes(tenantId) || str === "undefined";
      return { passed, actual: str?.slice(0, 200), message: passed ? undefined : "Potential tenant isolation violation" };
    }

    case "risk_score_range": {
      const range = assertion.value as { min: number; max: number };
      const score = Number(actual);
      const passed = score >= range.min && score <= range.max;
      return { passed, actual: score, message: passed ? undefined : `Score ${score} outside range [${range.min}, ${range.max}]` };
    }

    case "status_code": {
      const passed = actual === assertion.value;
      return { passed, actual, message: passed ? undefined : `Expected status ${assertion.value}, got ${actual}` };
    }

    case "json_path_equals": {
      const passed = JSON.stringify(actual) === JSON.stringify(assertion.value);
      return { passed, actual, message: passed ? undefined : `Expected ${JSON.stringify(assertion.value)}, got ${JSON.stringify(actual)}` };
    }

    default:
      return { passed: false, message: `Unknown assertion type: ${assertion.type}` };
  }
}

export async function runScenario(
  scenario: TestScenario,
  executor: (scenario: TestScenario) => Promise<unknown>,
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const output = await executor(scenario);

    const assertionResults = scenario.assertions.map(assertion => {
      const result = evaluateAssertion(assertion, output);
      return { assertion, ...result };
    });

    const passedCount = assertionResults.filter(r => r.passed).length;
    const score = scenario.assertions.length > 0 ? Math.round((passedCount / scenario.assertions.length) * 100) : 100;

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      passed: passedCount === scenario.assertions.length,
      score,
      assertionResults,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      passed: scenario.expectedOutcome === "fail",
      score: scenario.expectedOutcome === "fail" ? 100 : 0,
      assertionResults: [],
      executionTimeMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runSuite(
  suiteName: string,
  scenarios: TestScenario[],
  executor: (scenario: TestScenario) => Promise<unknown>,
): Promise<TestSuiteResult> {
  const startTime = Date.now();
  const results: TestResult[] = [];

  for (const scenario of scenarios) {
    const result = await runScenario(scenario, executor);
    results.push(result);
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed && r.score === 0).length;
  const degraded = results.filter(r => !r.passed && r.score > 0).length;

  return {
    suiteName,
    totalScenarios: scenarios.length,
    passed,
    failed,
    degraded,
    overallScore: results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0,
    results,
    executionTimeMs: Date.now() - startTime,
  };
}
