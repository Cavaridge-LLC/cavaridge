/**
 * @cavaridge/agent-runtime — Parallel Executor
 *
 * Runs multiple agents concurrently and aggregates results.
 */

import type {
  BaseAgent,
  AgentContext,
  AgentOutput,
  AgentMetadata,
  TokenUsage,
} from "@cavaridge/agent-core";
import { executeAgent } from "./executor.js";
import type { ExecutionOptions } from "./executor.js";

export interface ParallelTask<TIn, TOut> {
  id: string;
  agent: BaseAgent<TIn, TOut>;
  data: TIn;
  options?: ExecutionOptions;
}

export interface ParallelResult {
  /** Results keyed by task id */
  results: Record<string, { output: unknown; metadata: AgentMetadata }>;
  /** Tasks that failed */
  errors: Record<string, Error>;
  /** Aggregated totals */
  totalTokens: TokenUsage;
  totalCostUsd: number;
  totalTimeMs: number;
}

/**
 * Execute multiple agents concurrently.
 *
 * Usage:
 * ```ts
 * const result = await executeParallel(context, [
 *   { id: "tech", agent: extractorAgent, data: { text, type: "tech_stack" } },
 *   { id: "topology", agent: extractorAgent, data: { text, type: "topology" } },
 * ]);
 * ```
 */
export async function executeParallel(
  context: AgentContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: ParallelTask<any, any>[],
): Promise<ParallelResult> {
  const startTime = Date.now();
  const results: Record<string, { output: unknown; metadata: AgentMetadata }> = {};
  const errors: Record<string, Error> = {};
  const totalTokens: TokenUsage = { input: 0, output: 0, total: 0 };
  let totalCostUsd = 0;

  const promises = tasks.map(async (task) => {
    try {
      const output: AgentOutput<unknown> = await executeAgent(
        task.agent,
        { data: task.data, context },
        task.options,
      );

      results[task.id] = {
        output: output.result,
        metadata: output.metadata,
      };

      totalTokens.input += output.metadata.tokensUsed.input;
      totalTokens.output += output.metadata.tokensUsed.output;
      totalTokens.total += output.metadata.tokensUsed.total;
      totalCostUsd += output.metadata.costUsd;
    } catch (err) {
      errors[task.id] = err instanceof Error ? err : new Error(String(err));
    }
  });

  await Promise.allSettled(promises);

  return {
    results,
    errors,
    totalTokens,
    totalCostUsd,
    totalTimeMs: Date.now() - startTime,
  };
}
