/**
 * @cavaridge/agent-runtime — Agent Pipeline
 *
 * Chains multiple agents sequentially where the output of one
 * feeds as input to the next.
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

export interface PipelineStep<TIn, TOut> {
  agent: BaseAgent<TIn, TOut>;
  /** Transform previous output into this agent's input */
  transform?: (prev: unknown) => TIn;
  options?: ExecutionOptions;
}

export interface PipelineResult {
  /** Final output from the last agent */
  finalOutput: unknown;
  /** Metadata from each step */
  steps: Array<{ agentId: string; metadata: AgentMetadata }>;
  /** Aggregated totals */
  totalTokens: TokenUsage;
  totalCostUsd: number;
  totalTimeMs: number;
}

/**
 * Build and run a sequential agent pipeline.
 *
 * Usage:
 * ```ts
 * const result = await createPipeline(context)
 *   .add(docAgent, { transform: (input) => ({ content: input.text }) })
 *   .add(extractorAgent, { transform: (prev) => ({ text: prev.extractedText }) })
 *   .run(initialData);
 * ```
 */
export function createPipeline(context: AgentContext) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps: Array<PipelineStep<any, any>> = [];

  const pipeline = {
    add<TIn, TOut>(
      agent: BaseAgent<TIn, TOut>,
      opts?: { transform?: (prev: unknown) => TIn; options?: ExecutionOptions },
    ) {
      steps.push({
        agent,
        transform: opts?.transform,
        options: opts?.options,
      });
      return pipeline;
    },

    async run(initialData: unknown): Promise<PipelineResult> {
      const startTime = Date.now();
      const stepResults: Array<{ agentId: string; metadata: AgentMetadata }> = [];
      const totalTokens: TokenUsage = { input: 0, output: 0, total: 0 };
      let totalCostUsd = 0;
      let currentData: unknown = initialData;

      for (const step of steps) {
        const inputData = step.transform ? step.transform(currentData) : currentData;

        const output: AgentOutput<unknown> = await executeAgent(
          step.agent,
          { data: inputData, context },
          step.options,
        );

        stepResults.push({
          agentId: step.agent.config.agentId,
          metadata: output.metadata,
        });

        totalTokens.input += output.metadata.tokensUsed.input;
        totalTokens.output += output.metadata.tokensUsed.output;
        totalTokens.total += output.metadata.tokensUsed.total;
        totalCostUsd += output.metadata.costUsd;

        currentData = output.result;
      }

      return {
        finalOutput: currentData,
        steps: stepResults,
        totalTokens,
        totalCostUsd,
        totalTimeMs: Date.now() - startTime,
      };
    },
  };

  return pipeline;
}
