/**
 * Document Analysis Agent — Layer 2 Functional Agent
 *
 * Handles document classification, entity extraction, and vision analysis.
 * Parameterized by consuming app (classification types, pillar mappings).
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
  type AgentContext,
  AgentSecurityError,
} from "@cavaridge/agent-core";

// ── Types ────────────────────────────────────────────────────────────

export interface DocumentAnalysisInput {
  /** Text content to classify */
  content: string;
  /** Original filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** Base64 image data for vision analysis (optional) */
  imageBase64?: string;
  /** Image media type for vision (optional) */
  imageMediaType?: string;
}

export interface ClassificationResult {
  documentType: string;
  pillars: Record<string, boolean>;
  confidence: number;
  reasoning: string;
}

export interface VisionFinding {
  observation: string;
  risk_relevance: string;
  severity: string;
}

export interface VisionResult {
  description: string;
  classification: string;
  findings: VisionFinding[];
  extracted_text: string;
}

export interface DocumentAnalysisOutput {
  classification: ClassificationResult | null;
  vision: VisionResult | null;
}

export interface DocumentAnalysisOptions {
  /** Allowed document type values */
  allowedTypes: readonly string[];
  /** Pillar names to map */
  pillarNames: readonly string[];
  /** Classification system prompt override */
  classificationPrompt?: string;
  /** Vision analysis prompt override */
  visionPrompt?: string;
}

// ── Default prompts ──────────────────────────────────────────────────

const DEFAULT_CLASSIFICATION_PROMPT = `You are a document classifier for IT due diligence assessments. Given a document's filename and content excerpt, classify it and map it to assessment pillars.

Respond in JSON only, no markdown, no explanation:
{
  "document_type": "<one of the allowed types>",
  "pillars": { <pillar_name>: true/false for each pillar },
  "confidence": 0.0-1.0,
  "reasoning": "<one sentence explaining classification>"
}`;

const DEFAULT_VISION_PROMPT = `Analyze this IT infrastructure image for due diligence purposes.

Provide your analysis as a JSON object with:
{
  "description": "What does this image show?",
  "classification": "One of: network_diagram, server_rack, screenshot, dashboard, architecture_diagram, physical_infrastructure, other",
  "findings": [
    {
      "observation": "What you see that's relevant",
      "risk_relevance": "Why this matters",
      "severity": "critical|high|medium|low"
    }
  ],
  "extracted_text": "Any visible text in the image"
}

Be thorough but factual. Only report what you can actually see.`;

// ── Agent ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "document-analysis",
  agentName: "Document Analysis Agent",
  appCode: "CVG-CORE",
  version: "0.1.0",
};

export class DocumentAnalysisAgent extends BaseAgent<DocumentAnalysisInput, DocumentAnalysisOutput> {
  private options: DocumentAnalysisOptions;

  constructor(options: DocumentAnalysisOptions, config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
    this.options = options;
  }

  async validate(data: DocumentAnalysisInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.filename) errors.push("filename is required");
    if (!data.content && !data.imageBase64) errors.push("content or imageBase64 is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [
      {
        name: "classify_document",
        description: "Classify a document by type and map to assessment pillars",
        execute: async (params, ctx) => this.classifyDocument(params as unknown as DocumentAnalysisInput, ctx),
      },
      {
        name: "analyze_image",
        description: "Analyze an image using vision AI",
        execute: async (params, ctx) => this.analyzeImage(params as unknown as DocumentAnalysisInput, ctx),
      },
    ];
  }

  async execute(input: AgentInput<DocumentAnalysisInput>): Promise<AgentOutput<DocumentAnalysisOutput>> {
    const { data, context } = input;

    let classification: ClassificationResult | null = null;
    let vision: VisionResult | null = null;

    // Classify text content if present
    if (data.content && data.content.trim().length >= 10) {
      classification = await this.classifyDocument(data, context);
    }

    // Analyze image if present
    if (data.imageBase64) {
      vision = await this.analyzeImage(data, context);
    }

    return {
      result: { classification, vision },
      metadata: this.emptyMetadata(),
    };
  }

  async classifyDocument(data: DocumentAnalysisInput, context: AgentContext): Promise<ClassificationResult> {
    const fallback: ClassificationResult = {
      documentType: "unknown",
      pillars: Object.fromEntries(this.options.pillarNames.map(p => [p, false])),
      confidence: 0,
      reasoning: "Classification unavailable",
    };

    if (!this.hasAI()) return fallback;

    const excerpt = data.content.slice(0, 3000);
    if (!excerpt || excerpt.trim().length < 10) {
      return { ...fallback, reasoning: "Insufficient text content for classification" };
    }

    // Security scan on content
    const scan = this.scanInput(excerpt);
    if (scan.injection.isInjection && scan.injection.score > 0.8) {
      throw new AgentSecurityError(this.config.agentId, "Prompt injection detected in document content");
    }

    const systemPrompt = this.options.classificationPrompt ?? DEFAULT_CLASSIFICATION_PROMPT;
    const typesStr = this.options.allowedTypes.join(", ");
    const fullSystem = `${systemPrompt}\n\nAllowed document_type values:\n${typesStr}`;

    const response = await this.callLlm(
      context,
      "extraction",
      fullSystem,
      [{ role: "user", content: `Classify this document:\n\nFilename: ${data.filename}\nMIME: ${data.mimeType}\n\nContent excerpt:\n${excerpt}` }],
      { maxTokens: 500, temperature: 0.3 },
    );

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return fallback;
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        documentType: this.options.allowedTypes.includes(parsed.document_type) ? parsed.document_type : "unknown",
        pillars: Object.fromEntries(
          this.options.pillarNames.map(p => [p, !!parsed.pillars?.[p]]),
        ),
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
        reasoning: parsed.reasoning || "Classified by AI",
      };
    } catch {
      return fallback;
    }
  }

  async analyzeImage(data: DocumentAnalysisInput, context: AgentContext): Promise<VisionResult | null> {
    if (!this.hasAI() || !data.imageBase64) return null;

    const mediaType = data.imageMediaType || "image/jpeg";
    const prompt = this.options.visionPrompt ?? DEFAULT_VISION_PROMPT;

    const response = await this.callLlm(
      context,
      "vision",
      prompt,
      [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mediaType};base64,${data.imageBase64}` } },
          { type: "text", text: "Analyze this image." },
        ] as unknown as string,
      }],
      { maxTokens: 2000 },
    );

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        description: parsed.description || "No description provided",
        classification: parsed.classification || "Unclassified",
        findings: Array.isArray(parsed.findings) ? parsed.findings.map((f: Record<string, string>) => ({
          observation: f.observation || "",
          risk_relevance: f.risk_relevance || "",
          severity: ["critical", "high", "medium", "low"].includes(f.severity) ? f.severity : "low",
        })) : [],
        extracted_text: parsed.extracted_text || "",
      };
    } catch {
      return null;
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
