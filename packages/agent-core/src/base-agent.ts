/**
 * @cavaridge/agent-core — Abstract BaseAgent
 *
 * All functional and product agents extend this class.
 * Provides concrete helpers for LLM calls (via Spaniel), security scanning,
 * and audit logging so subclasses get them for free.
 */

import {
  chatCompletion,
  generateEmbedding,
  hasAICapability,
} from "@cavaridge/spaniel";
import type {
  SpanielRequest,
  SpanielRequestOptions,
  ChatMessage,
  SpanielResponse,
  TaskType,
  TokenUsage,
  EmbeddingOptions,
} from "@cavaridge/spaniel";
import {
  detectPromptInjection,
  scanForPii,
} from "@cavaridge/security";
import type { SecurityScanResult } from "@cavaridge/security";
import {
  AGENT_AUDIT_ACTIONS,
  AGENT_RESOURCE_TYPES,
} from "@cavaridge/audit";

import type {
  AgentConfig,
  AgentContext,
  AgentInput,
  AgentOutput,
  AgentMetadata,
  AgentToolDefinition,
} from "./types.js";
import { AgentLlmError, AgentSecurityError } from "./errors.js";

export abstract class BaseAgent<TInput, TOutput> {
  public readonly config: AgentConfig;

  /** Accumulated Spaniel responses from the current execution */
  protected spanielResponses: SpanielResponse[] = [];

  constructor(config: AgentConfig) {
    this.config = config;
  }

  // ── Abstract methods (subclasses must implement) ─────────────────

  /** Core execution logic */
  abstract execute(input: AgentInput<TInput>): Promise<AgentOutput<TOutput>>;

  /** Validate input before execution */
  abstract validate(data: TInput): Promise<{ valid: boolean; errors?: string[] }>;

  /** Declare available tools */
  abstract getTools(): AgentToolDefinition[];

  // ── Concrete helpers ─────────────────────────────────────────────

  /** Check if AI is available */
  hasAI(): boolean {
    return hasAICapability();
  }

  /** Call Spaniel chat completion with context auto-filled */
  protected async callLlm(
    context: AgentContext,
    taskType: TaskType,
    system: string,
    messages: ChatMessage[],
    options?: SpanielRequestOptions,
  ): Promise<SpanielResponse> {
    try {
      const request: SpanielRequest = {
        requestId: context.correlationId,
        tenantId: context.tenantId,
        userId: context.userId,
        appCode: context.config.appCode,
        taskType,
        system,
        messages,
        options: {
          maxTokens: options?.maxTokens ?? 4096,
          temperature: options?.temperature ?? 0.7,
          fallbackEnabled: options?.fallbackEnabled ?? true,
          requireConsensus: options?.requireConsensus ?? false,
        },
      };

      const response = await chatCompletion(request);
      this.spanielResponses.push(response);
      return response;
    } catch (err) {
      throw new AgentLlmError(
        this.config.agentId,
        taskType,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  /** Generate embeddings via Spaniel */
  protected async callEmbedding(
    context: AgentContext,
    input: string | string[],
  ): Promise<number[][]> {
    const opts: EmbeddingOptions = {
      tenantId: context.tenantId,
      userId: context.userId,
      appCode: context.config.appCode,
    };
    return generateEmbedding(input, opts);
  }

  /** Scan text for prompt injection and PII */
  protected scanInput(text: string): SecurityScanResult {
    const injection = detectPromptInjection(text);
    const pii = scanForPii(text);

    return {
      isClean: !injection.isInjection && pii.matches.length === 0,
      injection,
      pii,
    };
  }

  /**
   * Run the agent with audit logging and security scanning.
   * This is the primary entry point for callers.
   */
  async runWithAudit(input: AgentInput<TInput>): Promise<AgentOutput<TOutput>> {
    const startTime = Date.now();
    const { context } = input;
    this.spanielResponses = [];

    // Audit: execution starting
    await this.audit(context, AGENT_AUDIT_ACTIONS.PLAN_EXECUTING, {
      agentId: this.config.agentId,
      agentName: this.config.agentName,
    });

    try {
      // Execute the agent
      const output = await this.execute(input);

      // Enrich metadata with accumulated Spaniel data
      output.metadata = this.buildMetadata(output.metadata, startTime);

      // Audit: execution completed
      await this.audit(context, AGENT_AUDIT_ACTIONS.PLAN_COMPLETED, {
        agentId: this.config.agentId,
        executionTimeMs: output.metadata.executionTimeMs,
        tokensUsed: output.metadata.tokensUsed,
        costUsd: output.metadata.costUsd,
        modelsUsed: output.metadata.modelsUsed,
      });

      return output;
    } catch (err) {
      const executionTimeMs = Date.now() - startTime;

      // Audit: execution failed
      await this.audit(context, AGENT_AUDIT_ACTIONS.PLAN_FAILED, {
        agentId: this.config.agentId,
        executionTimeMs,
        error: err instanceof Error ? err.message : String(err),
      });

      throw err;
    }
  }

  // ── Internal helpers ─────────────────────────────────────────────

  /** Build final metadata from accumulated Spaniel responses */
  private buildMetadata(partial: AgentMetadata, startTime: number): AgentMetadata {
    const tokensUsed: TokenUsage = { input: 0, output: 0, total: 0 };
    let costUsd = 0;
    const modelsUsed = new Set<string>();

    for (const resp of this.spanielResponses) {
      tokensUsed.input += resp.tokens.input;
      tokensUsed.output += resp.tokens.output;
      tokensUsed.total += resp.tokens.total;
      costUsd += resp.cost.amount;
      if (resp.modelsUsed.primary) modelsUsed.add(resp.modelsUsed.primary);
      if (resp.modelsUsed.secondary) modelsUsed.add(resp.modelsUsed.secondary);
      if (resp.modelsUsed.tertiary) modelsUsed.add(resp.modelsUsed.tertiary);
    }

    return {
      ...partial,
      executionTimeMs: Date.now() - startTime,
      tokensUsed,
      costUsd,
      modelsUsed: Array.from(modelsUsed),
      spanielResponses: this.spanielResponses,
    };
  }

  /** Fire-and-forget audit log */
  private async audit(
    context: AgentContext,
    action: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    if (!context.auditLog) return;
    try {
      await context.auditLog({
        tenantId: context.tenantId,
        userId: context.userId,
        action,
        resourceType: AGENT_RESOURCE_TYPES.PLAN,
        resourceId: this.config.agentId,
        details,
        appCode: context.config.appCode,
        correlationId: context.correlationId,
      });
    } catch {
      // Audit logging must never block agent execution
    }
  }
}
