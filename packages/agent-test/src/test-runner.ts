/**
 * @cavaridge/agent-test — TestRunner
 *
 * BullMQ-backed job runner that executes test suites as background jobs.
 * Integrates ScoringEngine, CanaryGate, LangfuseTracer, and ScenarioLoader.
 */

import { Queue, Worker } from "bullmq";
import type { Job, ConnectionOptions } from "bullmq";
import { randomUUID } from "node:crypto";
import { ScoringEngine } from "./scoring-engine.js";
import { CanaryGate } from "./canary-gate.js";
import { LangfuseTracer } from "./langfuse-tracer.js";
import { ScenarioLoader } from "./scenario-loader.js";
import type {
  TestSuiteJobData,
  TestSuiteJobResult,
  TestScenario,
  ScenarioExecutor,
  CanaryStage,
  CanaryGateThresholds,
} from "./types.js";

const QUEUE_NAME = "agent-test";

export interface TestRunnerConfig {
  /** Redis connection options for BullMQ */
  connection: ConnectionOptions;
  /** Registry of named executors that the worker can resolve at runtime */
  executors?: Map<string, ScenarioExecutor>;
  /** Canary gate thresholds (defaults apply if omitted) */
  canaryThresholds?: Partial<CanaryGateThresholds>;
  /** Worker concurrency (default: 1 — sequential test execution) */
  concurrency?: number;
}

export class TestRunner {
  private readonly queue: Queue<TestSuiteJobData, TestSuiteJobResult>;
  private worker: Worker<TestSuiteJobData, TestSuiteJobResult> | null = null;
  private readonly executors: Map<string, ScenarioExecutor>;
  private readonly scoringEngine: ScoringEngine;
  private readonly canaryGate: CanaryGate;
  private readonly scenarioLoader: ScenarioLoader;
  private readonly config: TestRunnerConfig;

  constructor(config: TestRunnerConfig) {
    this.config = config;
    this.queue = new Queue(QUEUE_NAME, { connection: config.connection });
    this.executors = config.executors ?? new Map();
    this.scoringEngine = new ScoringEngine();
    this.canaryGate = new CanaryGate(config.canaryThresholds);
    this.scenarioLoader = new ScenarioLoader();
  }

  /**
   * Register a named executor that the worker can use to run scenarios.
   */
  registerExecutor(name: string, executor: ScenarioExecutor): void {
    this.executors.set(name, executor);
  }

  /**
   * Enqueue a test suite for background execution.
   *
   * @returns The test run ID and BullMQ job ID
   */
  async enqueue(params: {
    suiteName: string;
    agentVersion: string;
    scenarioSource: string | string[];
    executorName: string;
    langfuseConfig?: TestSuiteJobData["langfuseConfig"];
  }): Promise<{ testRunId: string; jobId: string }> {
    const testRunId = randomUUID();
    const job = await this.queue.add(
      `test-suite:${params.suiteName}`,
      {
        testRunId,
        suiteName: params.suiteName,
        agentVersion: params.agentVersion,
        scenarioSource: params.scenarioSource,
        executorName: params.executorName,
        langfuseConfig: params.langfuseConfig,
      },
      {
        attempts: 1,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    );

    return { testRunId, jobId: job.id ?? testRunId };
  }

  /**
   * Start the BullMQ worker to process test suite jobs.
   */
  startWorker(): void {
    if (this.worker) return;

    this.worker = new Worker<TestSuiteJobData, TestSuiteJobResult>(
      QUEUE_NAME,
      async (job: Job<TestSuiteJobData, TestSuiteJobResult>) => {
        return this.processJob(job);
      },
      {
        connection: this.config.connection,
        concurrency: this.config.concurrency ?? 1,
      },
    );
  }

  /**
   * Run a test suite directly (without BullMQ) — useful for CI and local dev.
   */
  async runDirect(params: {
    suiteName: string;
    agentVersion: string;
    scenarios: TestScenario[];
    executor: ScenarioExecutor;
    canaryStage?: CanaryStage;
    langfuseConfig?: TestSuiteJobData["langfuseConfig"];
  }): Promise<TestSuiteJobResult> {
    const testRunId = randomUUID();
    const tracer = new LangfuseTracer(params.langfuseConfig);

    try {
      const suiteResult = await this.scoringEngine.runSuite(
        params.suiteName,
        params.scenarios,
        params.executor,
      );

      // Trace to Langfuse
      const categoryMap = CanaryGate.buildCategoryMap(params.scenarios);
      tracer.traceSuiteResult(testRunId, params.agentVersion, suiteResult, categoryMap);

      // Evaluate canary gate if a stage was specified
      let canaryGateResult;
      if (params.canaryStage) {
        canaryGateResult = this.canaryGate.evaluate(
          params.agentVersion,
          params.canaryStage,
          suiteResult,
          categoryMap,
        );
      }

      await tracer.flush();

      return {
        testRunId,
        suiteResult,
        canaryGateResult,
        tracedToLangfuse: tracer !== null,
      };
    } finally {
      await tracer.shutdown();
    }
  }

  /**
   * Stop the worker and close the queue.
   */
  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    await this.queue.close();
  }

  private async processJob(
    job: Job<TestSuiteJobData, TestSuiteJobResult>,
  ): Promise<TestSuiteJobResult> {
    const { testRunId, suiteName, agentVersion, scenarioSource, executorName, langfuseConfig } = job.data;

    // Resolve executor
    const executor = this.executors.get(executorName);
    if (!executor) {
      throw new Error(`No executor registered for "${executorName}". Available: ${Array.from(this.executors.keys()).join(", ")}`);
    }

    // Load scenarios
    let scenarios: TestScenario[];
    if (typeof scenarioSource === "string") {
      scenarios = this.scenarioLoader.loadFile(scenarioSource);
    } else {
      // scenarioSource is an array of file paths
      scenarios = scenarioSource.flatMap(path => this.scenarioLoader.loadFile(path));
    }

    // Execute suite
    const suiteResult = await this.scoringEngine.runSuite(suiteName, scenarios, executor);

    // Trace
    const tracer = new LangfuseTracer(langfuseConfig);
    const categoryMap = CanaryGate.buildCategoryMap(scenarios);
    tracer.traceSuiteResult(testRunId, agentVersion, suiteResult, categoryMap);

    // Canary gate (default: evaluate for 10% → 50% promotion)
    const canaryGateResult = this.canaryGate.evaluate(
      agentVersion,
      "canary_10",
      suiteResult,
      categoryMap,
    );

    await tracer.flush();
    await tracer.shutdown();

    return {
      testRunId,
      suiteResult,
      canaryGateResult,
      tracedToLangfuse: langfuseConfig !== undefined,
    };
  }
}
