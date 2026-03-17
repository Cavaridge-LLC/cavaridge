/**
 * Research Agent — Layer 2 Functional Agent
 *
 * RAG-powered Q&A with citation tracking and confidence scoring.
 * Primary consumer: Ducky (CVG-RESEARCH), also used by Meridian, Forge.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
  AgentSecurityError,
} from "@cavaridge/agent-core";

// ── Types ────────────────────────────────────────────────────────────

export interface ResearchInput {
  /** User question */
  question: string;
  /** System prompt defining the agent persona and context */
  systemPrompt: string;
  /** Conversation history for multi-turn */
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  /** RAG context (documents, findings, etc.) to embed in system prompt */
  ragContext?: string;
  /** Max tokens for response */
  maxTokens?: number;
}

export interface ResearchOutput {
  /** The answer text */
  answer: string;
  /** Raw response for additional parsing by the caller */
  rawResponse: string;
}

// ── Agent ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "research-agent",
  agentName: "Research Agent",
  appCode: "CVG-CORE",
  version: "0.1.0",
};

export class ResearchAgent extends BaseAgent<ResearchInput, ResearchOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: ResearchInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.question || data.question.trim().length === 0) errors.push("question is required");
    if (!data.systemPrompt) errors.push("systemPrompt is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "research_question",
      description: "Answer a question using RAG context and conversation history",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as ResearchInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<ResearchInput>): Promise<AgentOutput<ResearchOutput>> {
    const { data, context } = input;

    if (!this.hasAI()) {
      return {
        result: { answer: "AI capability unavailable.", rawResponse: "" },
        metadata: this.emptyMetadata(),
      };
    }

    // Security scan on user question
    const scan = this.scanInput(data.question);
    if (scan.injection.isInjection && scan.injection.score > 0.8) {
      throw new AgentSecurityError(this.config.agentId, "Prompt injection detected in question");
    }

    // Build system prompt with RAG context
    const fullSystem = data.ragContext
      ? `${data.systemPrompt}\n\n--- Context ---\n${data.ragContext}`
      : data.systemPrompt;

    // Build messages array
    const messages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];
    if (data.conversationHistory) {
      for (const msg of data.conversationHistory) {
        messages.push(msg);
      }
    }
    messages.push({ role: "user", content: data.question });

    const response = await this.callLlm(
      context,
      "analysis",
      fullSystem,
      messages,
      { maxTokens: data.maxTokens ?? 2048, temperature: 0.7 },
    );

    return {
      result: {
        answer: response.content,
        rawResponse: response.content,
      },
      metadata: this.emptyMetadata(),
    };
  }

  private emptyMetadata(): AgentMetadata {
    return {
      requestId: crypto.randomUUID(),
      agentId: this.config.agentId,
      executionTimeMs: 0,
      tokensUsed: { input: 0, output: 0, total: 0 },
      costUsd: 0,
      modelsUsed: [],
    };
  }
}
