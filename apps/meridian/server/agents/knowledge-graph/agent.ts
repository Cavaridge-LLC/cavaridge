/**
 * Knowledge Graph Builder — Layer 3 Product Agent (Meridian)
 *
 * Extracts entities and relationships from M&A documents to build
 * an intelligence graph for deal analysis.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";
import type { KGEntity, KGRelationship, KnowledgeGraph, KGEntityType, KGRelationshipType } from "./types";

// ── Types ────────────────────────────────────────────────────────────

export interface KGBuilderInput {
  /** Deal identifier */
  dealId: string;
  /** Concatenated document text */
  documentText: string;
  /** Existing tech stack items for enrichment */
  techStack?: Array<{ itemName: string; category: string; status: string }>;
  /** Existing findings for enrichment */
  findings?: Array<{ title: string; severity: string; pillar: string }>;
}

export type { KnowledgeGraph, KGEntity, KGRelationship };

// ── System Prompt ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an M&A intelligence analyst building a knowledge graph from IT due diligence documents.

Extract entities and relationships to map the target company's technology landscape.

Entity types:
- organization: Companies, business units, departments
- technology: Software, platforms, services, infrastructure components
- person: Key personnel (CTO, IT Director, vendors POCs)
- contract: Agreements, licenses, SLAs, MSAs
- risk: Identified risks, vulnerabilities, compliance gaps
- site: Physical locations, data centers, offices
- integration: Systems that need to be integrated or migrated
- vendor: Third-party providers
- system: Internal systems, applications, databases

Relationship types:
- uses: Entity uses/runs a technology
- depends_on: Entity depends on another
- manages: Person manages a system/team
- contains: Site contains infrastructure
- risks: A risk affects an entity
- integrates_with: System integrates with another
- replaces: New system replaces old
- provides: Vendor provides a service
- located_at: System/person is at a site
- contracts_with: Organization has contract with vendor

Respond with JSON only:
{
  "entities": [
    { "id": "e1", "type": "technology", "name": "...", "properties": { "category": "...", "version": "...", "status": "..." }, "source_documents": [], "confidence": 0.0-1.0 }
  ],
  "relationships": [
    { "id": "r1", "source_id": "e1", "target_id": "e2", "type": "uses", "properties": { "context": "..." }, "confidence": 0.0-1.0 }
  ]
}

IMPORTANT: Extract at least 10 entities and 10 relationships. Be thorough. Only respond with valid JSON.`;

// ── Agent ────────────────────────────────────────────────────────────

const AGENT_CONFIG: AgentConfig = {
  agentId: "knowledge-graph-builder",
  agentName: "Knowledge Graph Builder",
  appCode: "CVG-MER",
  version: "0.1.0",
};

const VALID_ENTITY_TYPES: KGEntityType[] = [
  "organization", "technology", "person", "contract",
  "risk", "site", "integration", "vendor", "system",
];

const VALID_RELATIONSHIP_TYPES: KGRelationshipType[] = [
  "uses", "depends_on", "manages", "contains", "risks",
  "integrates_with", "replaces", "provides", "located_at", "contracts_with",
];

export class KnowledgeGraphBuilderAgent extends BaseAgent<KGBuilderInput, KnowledgeGraph> {
  constructor() {
    super(AGENT_CONFIG);
  }

  async validate(data: KGBuilderInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.dealId) errors.push("dealId is required");
    if (!data.documentText || data.documentText.trim().length < 50) {
      errors.push("documentText must be at least 50 characters");
    }
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "build_knowledge_graph",
      description: "Extract entities and relationships from M&A documents to build a knowledge graph",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as KGBuilderInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<KGBuilderInput>): Promise<AgentOutput<KnowledgeGraph>> {
    const { data, context } = input;

    const emptyGraph: KnowledgeGraph = {
      entities: [],
      relationships: [],
      metadata: {
        dealId: data.dealId,
        entityCount: 0,
        relationshipCount: 0,
        buildTimestamp: new Date().toISOString(),
      },
    };

    if (!this.hasAI()) {
      return { result: emptyGraph, metadata: this.emptyMetadata() };
    }

    // Build enrichment context
    let enrichment = "";
    if (data.techStack?.length) {
      enrichment += `\n\nKnown Tech Stack:\n${data.techStack.map(t => `- ${t.itemName} (${t.category}, ${t.status})`).join("\n")}`;
    }
    if (data.findings?.length) {
      enrichment += `\n\nKnown Findings:\n${data.findings.map(f => `- [${f.severity}] ${f.title} (${f.pillar})`).join("\n")}`;
    }

    const truncatedText = data.documentText.slice(0, 50000);

    const response = await this.callLlm(
      context,
      "extraction",
      SYSTEM_PROMPT,
      [{
        role: "user",
        content: `Build a knowledge graph from these M&A due diligence documents:\n\n${truncatedText}${enrichment}`,
      }],
      { maxTokens: 4096, temperature: 0.3 },
    );

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { result: emptyGraph, metadata: this.emptyMetadata() };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and normalize entities
      const entities: KGEntity[] = (Array.isArray(parsed.entities) ? parsed.entities : [])
        .map((e: Record<string, unknown>) => ({
          id: String(e.id || crypto.randomUUID()),
          type: VALID_ENTITY_TYPES.includes(e.type as KGEntityType) ? e.type as KGEntityType : "system",
          name: String(e.name || "Unknown"),
          properties: (e.properties as Record<string, unknown>) || {},
          sourceDocumentIds: Array.isArray(e.source_documents) ? e.source_documents as string[] : [],
          confidence: typeof e.confidence === "number" ? e.confidence : 0.5,
        }));

      // Validate and normalize relationships
      const entityIds = new Set(entities.map(e => e.id));
      const relationships: KGRelationship[] = (Array.isArray(parsed.relationships) ? parsed.relationships : [])
        .filter((r: Record<string, unknown>) =>
          entityIds.has(String(r.source_id)) && entityIds.has(String(r.target_id))
        )
        .map((r: Record<string, unknown>) => ({
          id: String(r.id || crypto.randomUUID()),
          sourceEntityId: String(r.source_id),
          targetEntityId: String(r.target_id),
          type: VALID_RELATIONSHIP_TYPES.includes(r.type as KGRelationshipType) ? r.type as KGRelationshipType : "uses",
          properties: (r.properties as Record<string, unknown>) || {},
          confidence: typeof r.confidence === "number" ? r.confidence : 0.5,
        }));

      const graph: KnowledgeGraph = {
        entities,
        relationships,
        metadata: {
          dealId: data.dealId,
          entityCount: entities.length,
          relationshipCount: relationships.length,
          buildTimestamp: new Date().toISOString(),
        },
      };

      return { result: graph, metadata: this.emptyMetadata() };
    } catch {
      return { result: emptyGraph, metadata: this.emptyMetadata() };
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
