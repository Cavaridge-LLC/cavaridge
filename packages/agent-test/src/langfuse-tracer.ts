/**
 * @cavaridge/agent-test — LangfuseTracer
 *
 * Traces all test executions to Langfuse with structured metadata:
 * test_run_id, agent_version, scenario_id, category, outcome, score.
 */

import { Langfuse } from "langfuse";
import type {
  LangfuseTraceConfig,
  TraceMetadata,
  TestResult,
  TestSuiteResult,
  ScenarioCategory,
} from "./types.js";

export class LangfuseTracer {
  private client: Langfuse | null = null;
  private readonly enabled: boolean;

  constructor(config?: LangfuseTraceConfig) {
    this.enabled = config?.enabled !== false && !!config?.publicKey && !!config?.secretKey;

    if (this.enabled && config) {
      this.client = new Langfuse({
        publicKey: config.publicKey,
        secretKey: config.secretKey,
        baseUrl: config.baseUrl ?? "https://cloud.langfuse.com",
      });
    }
  }

  /**
   * Trace a single scenario result.
   */
  traceScenarioResult(
    testRunId: string,
    agentVersion: string,
    category: ScenarioCategory,
    result: TestResult,
  ): void {
    if (!this.client) return;

    const metadata: TraceMetadata = {
      testRunId,
      agentVersion,
      scenarioId: result.scenarioId,
      category,
      outcome: result.outcome,
      score: result.score,
      executionTimeMs: result.executionTimeMs,
    };

    const trace = this.client.trace({
      name: `agent-test:${result.scenarioId}`,
      metadata,
      tags: [
        `test_run:${testRunId}`,
        `agent_version:${agentVersion}`,
        `category:${category}`,
        `outcome:${result.outcome}`,
      ],
    });

    // Log each assertion as a span within the trace
    for (const ar of result.assertionResults) {
      trace.span({
        name: `assertion:${ar.assertion.type}`,
        metadata: {
          field: ar.assertion.field,
          expected: ar.assertion.value,
          actual: ar.actual,
          passed: ar.passed,
          description: ar.assertion.description,
        },
        level: ar.passed ? "DEFAULT" : "ERROR",
        statusMessage: ar.passed ? "PASSED" : (ar.message ?? "FAILED"),
      });
    }

    // Add a score observation
    trace.score({
      name: "scenario_score",
      value: result.score / 100,
      comment: `${result.outcome}: ${result.score}/100`,
    });
  }

  /**
   * Trace an entire suite run.
   */
  traceSuiteResult(
    testRunId: string,
    agentVersion: string,
    suiteResult: TestSuiteResult,
    categoryMap: Map<string, ScenarioCategory>,
  ): void {
    if (!this.client) return;

    // Top-level suite trace
    const suiteTrace = this.client.trace({
      name: `agent-test-suite:${suiteResult.suiteName}`,
      metadata: {
        testRunId,
        agentVersion,
        totalScenarios: suiteResult.totalScenarios,
        passed: suiteResult.passed,
        failed: suiteResult.failed,
        degraded: suiteResult.degraded,
        overallScore: suiteResult.overallScore,
        executionTimeMs: suiteResult.executionTimeMs,
      },
      tags: [
        `test_run:${testRunId}`,
        `agent_version:${agentVersion}`,
        `suite:${suiteResult.suiteName}`,
      ],
    });

    suiteTrace.score({
      name: "suite_score",
      value: suiteResult.overallScore / 100,
      comment: `${suiteResult.passed}/${suiteResult.totalScenarios} passed`,
    });

    // Individual scenario traces
    for (const result of suiteResult.results) {
      const category = categoryMap.get(result.scenarioId) ?? "functional";
      this.traceScenarioResult(testRunId, agentVersion, category, result);
    }
  }

  /**
   * Flush pending traces. Call this before process exit.
   */
  async flush(): Promise<void> {
    if (this.client) {
      await this.client.flushAsync();
    }
  }

  /**
   * Shut down the Langfuse client.
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.shutdownAsync();
      this.client = null;
    }
  }
}
