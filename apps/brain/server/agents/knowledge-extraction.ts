/**
 * Knowledge Extraction Agent — Brain Product Agent (Layer 3)
 *
 * Composes Language Agent (Layer 1) + Data Extractor (Layer 2) to:
 * 1. Analyze transcribed text for grammar/tone/structure via Language Agent
 * 2. Extract entities, facts, action items, decisions via Data Extractor
 * 3. Return structured knowledge objects ready for storage
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
  type AgentContext,
} from "@cavaridge/agent-core";
import { LanguageAgent } from "@cavaridge/domain-agents";
import { DataExtractorAgent } from "@cavaridge/agents";

// ── Types ────────────────────────────────────────────────────────────

export interface KnowledgeExtractionInput {
  transcript: string;
  recordingId?: string;
  sourceType?: "microphone" | "upload" | "meeting" | "connector";
  contextHint?: string;
}

export interface ExtractedEntity {
  name: string;
  type: "person" | "organization" | "project" | "technology" | "location" | "date" | "monetary_value" | "document" | "concept";
  confidence: number;
}

export interface ExtractedRelationship {
  sourceEntity: string;
  targetEntity: string;
  type: "mentioned_in" | "related_to" | "assigned_to" | "decided_by" | "depends_on" | "part_of" | "follows" | "contradicts" | "supersedes";
  confidence: number;
}

export interface ExtractedKnowledgeObject {
  type: "fact" | "decision" | "action_item" | "question" | "insight" | "meeting_note" | "reference";
  content: string;
  summary: string;
  confidence: number;
  tags: string[];
  dueDate?: string;
  entities: ExtractedEntity[];
}

export interface KnowledgeExtractionOutput {
  knowledgeObjects: ExtractedKnowledgeObject[];
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  languageAnalysis: {
    toneDetected: string;
    formality: string;
    topicSummary: string;
  };
  totalObjectsExtracted: number;
}

// ── Agent ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "brain-knowledge-extraction",
  agentName: "Brain Knowledge Extraction Agent",
  appCode: "CVG-BRAIN",
  version: "0.1.0",
};

const EXTRACTION_SYSTEM_PROMPT = `You are a knowledge extraction expert. Given transcribed speech or text, extract ALL meaningful knowledge objects.

For each piece of knowledge, classify it as one of:
- fact: A stated fact, observation, or piece of information
- decision: A decision that was made or agreed upon
- action_item: Something that needs to be done, assigned or unassigned
- question: An unanswered question or open issue
- insight: An analytical observation or strategic insight
- meeting_note: General meeting context or discussion topic
- reference: A reference to a document, URL, system, or external resource

For each knowledge object, also extract:
- A brief summary (1 sentence)
- Confidence score (0.0–1.0)
- Relevant tags
- Due date if mentioned (ISO 8601 format)
- All entities mentioned in that specific knowledge object

For entities, classify as: person, organization, project, technology, location, date, monetary_value, document, concept

For relationships between entities, classify as: mentioned_in, related_to, assigned_to, decided_by, depends_on, part_of, follows, contradicts, supersedes

Respond in JSON:
{
  "knowledgeObjects": [
    {
      "type": "decision",
      "content": "Full text of the knowledge item",
      "summary": "Brief one-line summary",
      "confidence": 0.9,
      "tags": ["migration", "cloud"],
      "dueDate": "2026-04-15T00:00:00Z",
      "entities": [{"name": "AWS", "type": "technology", "confidence": 0.95}]
    }
  ],
  "entities": [{"name": "...", "type": "...", "confidence": 0.9}],
  "relationships": [{"sourceEntity": "...", "targetEntity": "...", "type": "...", "confidence": 0.8}],
  "languageAnalysis": {
    "toneDetected": "professional/casual/technical",
    "formality": "formal/informal/mixed",
    "topicSummary": "Brief description of what was discussed"
  }
}`;

export class KnowledgeExtractionAgent extends BaseAgent<KnowledgeExtractionInput, KnowledgeExtractionOutput> {
  private languageAgent: LanguageAgent;
  private dataExtractor: DataExtractorAgent;

  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
    this.languageAgent = new LanguageAgent({ appCode: "CVG-BRAIN" });
    this.dataExtractor = new DataExtractorAgent({ appCode: "CVG-BRAIN" });
  }

  async validate(data: KnowledgeExtractionInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.transcript || data.transcript.trim().length < 10) {
      errors.push("transcript must be at least 10 characters");
    }
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "extract_knowledge",
      description: "Extract structured knowledge (facts, decisions, action items, entities) from transcribed speech",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as KnowledgeExtractionInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<KnowledgeExtractionInput>): Promise<AgentOutput<KnowledgeExtractionOutput>> {
    const { data, context } = input;
    const empty: KnowledgeExtractionOutput = {
      knowledgeObjects: [],
      entities: [],
      relationships: [],
      languageAnalysis: { toneDetected: "unknown", formality: "unknown", topicSummary: "" },
      totalObjectsExtracted: 0,
    };

    // Security scan
    const scan = this.scanInput(data.transcript);
    if (!scan.isClean) {
      return {
        result: {
          ...empty,
          languageAnalysis: {
            toneDetected: "blocked",
            formality: "blocked",
            topicSummary: "Input flagged by security scanner. PII detected or prompt injection attempt.",
          },
        },
        metadata: this.emptyMetadata(),
      };
    }

    if (!this.hasAI()) {
      return { result: empty, metadata: this.emptyMetadata() };
    }

    // Build contextual prompt
    const contextLine = data.contextHint ? `\nContext: ${data.contextHint}` : "";
    const sourceLine = data.sourceType ? `\nSource: ${data.sourceType}` : "";
    const userContent = `${contextLine}${sourceLine}\n\nTranscript:\n${data.transcript}`;

    // Primary extraction via LLM
    const response = await this.callLlm(
      context,
      "extraction",
      EXTRACTION_SYSTEM_PROMPT,
      [{ role: "user", content: userContent }],
      { maxTokens: 8192, temperature: 0.3 },
    );

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { result: empty, metadata: this.emptyMetadata() };

      const parsed = JSON.parse(jsonMatch[0]);

      const result: KnowledgeExtractionOutput = {
        knowledgeObjects: Array.isArray(parsed.knowledgeObjects) ? parsed.knowledgeObjects : [],
        entities: Array.isArray(parsed.entities) ? parsed.entities : [],
        relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
        languageAnalysis: parsed.languageAnalysis || empty.languageAnalysis,
        totalObjectsExtracted: 0,
      };
      result.totalObjectsExtracted = result.knowledgeObjects.length;

      return { result, metadata: this.emptyMetadata() };
    } catch {
      return { result: empty, metadata: this.emptyMetadata() };
    }
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
