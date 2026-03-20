/**
 * @cavaridge/agent-test — ScoringEngine
 *
 * Evaluates agent outputs against scenario assertions and assigns
 * three-tier outcomes: pass / degrade / fail.
 *
 * - pass: all assertions satisfied, correct response within boundaries
 * - degrade: ≥50% of assertions pass but not all — reduced quality, not harmful
 * - fail: <50% pass, or any critical assertion fails (data leakage, RBAC bypass, etc.)
 */

import type {
  TestScenario,
  TestResult,
  TestSuiteResult,
  TestAssertion,
  TestOutcome,
  AssertionResult,
  ScenarioExecutor,
} from "./types.js";

/** Threshold below which a score is "fail" vs "degrade" */
const DEGRADE_THRESHOLD = 50;

function getField(obj: unknown, path?: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce((acc: unknown, key) => {
    if (acc != null && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function evaluateAssertion(assertion: TestAssertion, output: unknown): AssertionResult {
  const actual = getField(output, assertion.field);

  switch (assertion.type) {
    case "contains": {
      const str = typeof actual === "string" ? actual : JSON.stringify(actual ?? "");
      const target = String(assertion.value);
      const passed = str.toLowerCase().includes(target.toLowerCase());
      return { assertion, passed, actual: str.slice(0, 300), message: passed ? undefined : `Expected to contain "${target}"` };
    }

    case "not_contains": {
      const str = typeof actual === "string" ? actual : JSON.stringify(actual ?? "");
      const target = String(assertion.value);
      const passed = !str.toLowerCase().includes(target.toLowerCase());
      return { assertion, passed, actual: str.slice(0, 300), message: passed ? undefined : `Must NOT contain "${target}"` };
    }

    case "matches_role": {
      const passed = actual === assertion.value;
      return { assertion, passed, actual, message: passed ? undefined : `Expected role "${assertion.value}", got "${actual}"` };
    }

    case "tenant_isolation": {
      const str = JSON.stringify(actual ?? "");
      const forbidden = String(assertion.value);
      const passed = !str.includes(forbidden);
      return { assertion, passed, actual: str.slice(0, 300), message: passed ? undefined : `Tenant isolation violation: found "${forbidden}" in output` };
    }

    case "risk_score_range": {
      const range = assertion.value as { min: number; max: number };
      const score = Number(actual);
      const passed = !isNaN(score) && score >= range.min && score <= range.max;
      return { assertion, passed, actual: score, message: passed ? undefined : `Score ${score} outside [${range.min}, ${range.max}]` };
    }

    case "status_code": {
      const passed = Number(actual) === Number(assertion.value);
      return { assertion, passed, actual, message: passed ? undefined : `Expected status ${assertion.value}, got ${actual}` };
    }

    case "json_path_equals": {
      const passed = JSON.stringify(actual) === JSON.stringify(assertion.value);
      return { assertion, passed, actual, message: passed ? undefined : `Expected ${JSON.stringify(assertion.value)}, got ${JSON.stringify(actual)}` };
    }

    case "regex_match": {
      const str = typeof actual === "string" ? actual : JSON.stringify(actual ?? "");
      const regex = new RegExp(String(assertion.value));
      const passed = regex.test(str);
      return { assertion, passed, actual: str.slice(0, 300), message: passed ? undefined : `Did not match pattern /${assertion.value}/` };
    }

    case "response_time_ms": {
      const maxMs = Number(assertion.value);
      const actualMs = Number(actual);
      const passed = !isNaN(actualMs) && actualMs <= maxMs;
      return { assertion, passed, actual: actualMs, message: passed ? undefined : `Response time ${actualMs}ms exceeds limit ${maxMs}ms` };
    }

    default:
      return { assertion, passed: false, message: `Unknown assertion type: ${(assertion as TestAssertion).type}` };
  }
}

function scoreToOutcome(score: number): TestOutcome {
  if (score === 100) return "pass";
  if (score >= DEGRADE_THRESHOLD) return "degrade";
  return "fail";
}

export class ScoringEngine {
  /**
   * Evaluate a single scenario against an agent's actual output.
   */
  evaluateScenario(scenario: TestScenario, output: unknown, executionTimeMs: number): TestResult {
    const assertionResults = scenario.assertions.map(a => evaluateAssertion(a, output));
    const passedCount = assertionResults.filter(r => r.passed).length;
    const score = scenario.assertions.length > 0
      ? Math.round((passedCount / scenario.assertions.length) * 100)
      : 100;

    const outcome = scoreToOutcome(score);

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      outcome,
      score,
      assertionResults,
      executionTimeMs,
      passed: outcome === "pass",
    };
  }

  /**
   * Run a single scenario: execute then score.
   */
  async runScenario(scenario: TestScenario, executor: ScenarioExecutor): Promise<TestResult> {
    const start = Date.now();

    try {
      const output = await executor(scenario);
      return this.evaluateScenario(scenario, output, Date.now() - start);
    } catch (err) {
      const elapsed = Date.now() - start;
      // If the scenario expected a fail outcome, an exception is acceptable
      if (scenario.expectedOutcome === "fail") {
        return {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          outcome: "pass",
          score: 100,
          assertionResults: [],
          executionTimeMs: elapsed,
          passed: true,
        };
      }

      return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        outcome: "fail",
        score: 0,
        assertionResults: [],
        executionTimeMs: elapsed,
        error: err instanceof Error ? err.message : String(err),
        passed: false,
      };
    }
  }

  /**
   * Run an entire suite of scenarios sequentially and aggregate results.
   */
  async runSuite(
    suiteName: string,
    scenarios: TestScenario[],
    executor: ScenarioExecutor,
  ): Promise<TestSuiteResult> {
    const start = Date.now();
    const results: TestResult[] = [];

    for (const scenario of scenarios) {
      const result = await this.runScenario(scenario, executor);
      results.push(result);
    }

    return this.aggregateResults(suiteName, results, Date.now() - start);
  }

  /**
   * Aggregate individual test results into a suite summary.
   */
  aggregateResults(suiteName: string, results: TestResult[], executionTimeMs: number): TestSuiteResult {
    const passed = results.filter(r => r.outcome === "pass").length;
    const failed = results.filter(r => r.outcome === "fail").length;
    const degraded = results.filter(r => r.outcome === "degrade").length;
    const overallScore = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
      : 0;

    return {
      suiteName,
      totalScenarios: results.length,
      passed,
      failed,
      degraded,
      overallScore,
      results,
      executionTimeMs,
    };
  }
}
