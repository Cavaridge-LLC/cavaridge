/**
 * Recall Agent — Brain Product Agent (Layer 3)
 *
 * Handles natural language recall queries.
 * Uses semantic similarity (pgvector) to find relevant knowledge objects,
 * then uses Ducky → Spaniel to synthesize a natural language answer.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

// ── Types ────────────────────────────────────────────────────────────

export interface RecallInput {
  query: string;
  tenantId: string;
  userId: string;
  filters?: {
    type?: string[];
    tags?: string[];
    dateFrom?: string;
    dateTo?: string;
    entityName?: string;
  };
  maxResults?: number;
}

export interface RecalledKnowledge {
  id: string;
  type: string;
  content: string;
  summary: string;
  confidence: number;
  similarity: number;
  tags: string[];
  entities: Array<{ name: string; type: string }>;
  createdAt: string;
  recordingId?: string;
}

export interface RecallOutput {
  answer: string;
  sources: RecalledKnowledge[];
  queryEmbedding?: number[];
  totalMatches: number;
}

// ── Agent ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "brain-recall",
  agentName: "Brain Recall Agent",
  appCode: "CVG-BRAIN",
  version: "0.1.0",
};

const RECALL_SYSTEM_PROMPT = `You are Ducky Intelligence, the AI assistant for Cavaridge's Brain knowledge capture system. A user is asking a recall question about information they previously captured through voice recordings or notes.

You have been provided with relevant knowledge objects retrieved from their knowledge base. Use ONLY these sources to answer. If the sources don't contain enough information to answer the question, say so clearly.

Rules:
- Be conversational but precise
- Reference specific knowledge objects when answering
- If multiple sources conflict, note the discrepancy
- If the user asks about action items, include their status (resolved/pending)
- Never fabricate information not in the sources
- If asked "what did we decide about X", focus on decision-type knowledge objects
- Include dates when relevant

Respond in JSON:
{
  "answer": "Natural language answer to the user's question",
  "sourceIds": ["ids of knowledge objects used in the answer"]
}`;

export class RecallAgent extends BaseAgent<RecallInput, RecallOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: RecallInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.query || data.query.trim().length < 3) errors.push("query must be at least 3 characters");
    if (!data.tenantId) errors.push("tenantId is required");
    if (!data.userId) errors.push("userId is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "recall_knowledge",
      description: "Search and recall previously captured knowledge using natural language",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as RecallInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  /**
   * Execute recall — this generates the embedding and synthesizes the answer.
   * The actual vector search is done by the route handler which has DB access.
   * The agent receives pre-fetched sources in input.data as an extended type.
   */
  async execute(input: AgentInput<RecallInput & { sources?: RecalledKnowledge[] }>): Promise<AgentOutput<RecallOutput>> {
    const { data, context } = input;
    const sources = data.sources || [];

    const empty: RecallOutput = {
      answer: "I don't have any matching knowledge to answer that question.",
      sources: [],
      totalMatches: 0,
    };

    // Security scan
    const scan = this.scanInput(data.query);
    if (!scan.isClean) {
      return {
        result: {
          answer: "Your query was flagged by security. Please rephrase without including sensitive data.",
          sources: [],
          totalMatches: 0,
        },
        metadata: this.emptyMetadata(),
      };
    }

    // Generate query embedding for vector search
    let queryEmbedding: number[] | undefined;
    if (this.hasAI()) {
      try {
        const embeddings = await this.callEmbedding(context, data.query);
        queryEmbedding = embeddings[0];
      } catch {
        // Embedding generation failed — continue without it
      }
    }

    // If no sources provided (embedding-only mode), return embedding for caller to search
    if (sources.length === 0) {
      return {
        result: { ...empty, queryEmbedding },
        metadata: this.emptyMetadata(),
      };
    }

    if (!this.hasAI()) {
      return {
        result: { answer: "AI unavailable. Here are the matching sources.", sources, totalMatches: sources.length },
        metadata: this.emptyMetadata(),
      };
    }

    // Build context from sources
    const sourceContext = sources.map((s, i) =>
      `[Source ${i + 1}] (${s.type}, ${s.createdAt}, similarity: ${s.similarity.toFixed(2)})\n${s.content}\nTags: ${s.tags.join(", ")}\nEntities: ${s.entities.map(e => e.name).join(", ")}`
    ).join("\n\n");

    const response = await this.callLlm(
      context,
      "analysis",
      RECALL_SYSTEM_PROMPT,
      [{
        role: "user",
        content: `Question: ${data.query}\n\nKnowledge Sources:\n${sourceContext}`,
      }],
      { maxTokens: 2048, temperature: 0.4 },
    );

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          result: {
            answer: parsed.answer || empty.answer,
            sources,
            queryEmbedding,
            totalMatches: sources.length,
          },
          metadata: this.emptyMetadata(),
        };
      }
    } catch {
      // JSON parse failed — use raw response
    }

    return {
      result: {
        answer: response.content,
        sources,
        queryEmbedding,
        totalMatches: sources.length,
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
