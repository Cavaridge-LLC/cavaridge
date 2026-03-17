/**
 * @cavaridge/agent-runtime — Agent Executor
 *
 * Handles single agent execution with retry, timeout, and error handling.
 */

import type {
  BaseAgent,
  AgentInput,
  AgentOutput,
} from "@cavaridge/agent-core";
import {
  AgentError,
  AgentValidationError,
  AgentSecurityError,
} from "@cavaridge/agent-core";

export interface ExecutionOptions {
  /** Max retry attempts for transient failures (default: 2) */
  maxRetries?: number;
  /** Timeout in milliseconds (default: 60000) */
  timeoutMs?: number;
  /** Whether to validate input before execution (default: true) */
  validateInput?: boolean;
}

const DEFAULT_OPTIONS: Required<ExecutionOptions> = {
  maxRetries: 2,
  timeoutMs: 60_000,
  validateInput: true,
};

/**
 * Execute an agent with retry logic, timeout, and validation.
 * Uses `runWithAudit()` which handles audit logging internally.
 */
export async function executeAgent<TInput, TOutput>(
  agent: BaseAgent<TInput, TOutput>,
  input: AgentInput<TInput>,
  options?: ExecutionOptions,
): Promise<AgentOutput<TOutput>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Validate input if requested
  if (opts.validateInput) {
    const validation = await agent.validate(input.data);
    if (!validation.valid) {
      throw new AgentValidationError(
        agent.config.agentId,
        validation.errors ?? ["Unknown validation error"],
      );
    }
  }

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await withTimeout(
        agent.runWithAudit(input),
        opts.timeoutMs,
        agent.config.agentId,
      );
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Never retry security errors or validation errors
      if (err instanceof AgentSecurityError || err instanceof AgentValidationError) {
        throw err;
      }

      // Don't retry on last attempt
      if (attempt === opts.maxRetries) break;

      // Exponential backoff: 1s, 2s, 4s...
      const backoffMs = Math.min(1000 * Math.pow(2, attempt), 8000);
      await sleep(backoffMs);
    }
  }

  throw lastError ?? new AgentError("Execution failed", agent.config.agentId, "UNKNOWN");
}

/** Wrap a promise with a timeout */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  agentId: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AgentError(`Agent timed out after ${timeoutMs}ms`, agentId, "TIMEOUT"));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
