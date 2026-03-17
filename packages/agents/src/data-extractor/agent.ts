/**
 * Data Extractor Agent — Layer 2 Functional Agent
 *
 * Extracts structured data from unstructured text.
 * Used for tech stack extraction, topology mapping, entity extraction.
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

export interface DataExtractorInput {
  /** Source text to extract from */
  text: string;
  /** What to extract */
  extractionType: string;
  /** System prompt for the extraction */
  systemPrompt: string;
  /** User prompt template (text will be appended) */
  userPrompt?: string;
  /** Max tokens for response */
  maxTokens?: number;
}

export interface DataExtractorOutput {
  /** Parsed items (generic — caller casts to specific type) */
  items: unknown[];
  /** Raw LLM response for debugging */
  rawResponse: string;
  /** Number of items extracted */
  count: number;
}

// ── Agent ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "data-extractor",
  agentName: "Data Extractor Agent",
  appCode: "CVG-CORE",
  version: "0.1.0",
};

export class DataExtractorAgent extends BaseAgent<DataExtractorInput, DataExtractorOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: DataExtractorInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.text || data.text.trim().length < 10) errors.push("text must be at least 10 characters");
    if (!data.extractionType) errors.push("extractionType is required");
    if (!data.systemPrompt) errors.push("systemPrompt is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "extract_data",
      description: "Extract structured data from unstructured text",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as DataExtractorInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<DataExtractorInput>): Promise<AgentOutput<DataExtractorOutput>> {
    const { data, context } = input;

    if (!this.hasAI()) {
      return {
        result: { items: [], rawResponse: "", count: 0 },
        metadata: this.emptyMetadata(),
      };
    }

    const userContent = data.userPrompt
      ? `${data.userPrompt}\n\n${data.text}`
      : data.text;

    const response = await this.callLlm(
      context,
      "extraction",
      data.systemPrompt,
      [{ role: "user", content: userContent }],
      { maxTokens: data.maxTokens ?? 4096, temperature: 0.3 },
    );

    let items: unknown[] = [];
    try {
      // Try array first, then object with nested array
      const arrayMatch = response.content.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        items = JSON.parse(arrayMatch[0]);
      } else {
        const objMatch = response.content.match(/\{[\s\S]*\}/);
        if (objMatch) {
          const obj = JSON.parse(objMatch[0]);
          // Find first array property
          for (const val of Object.values(obj)) {
            if (Array.isArray(val)) {
              items = val;
              break;
            }
          }
          if (items.length === 0) items = [obj];
        }
      }
    } catch {
      // Parse failed — return empty
    }

    return {
      result: {
        items,
        rawResponse: response.content,
        count: items.length,
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
