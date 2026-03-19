/**
 * Language Agent — Layer 1 Domain Specialist
 *
 * Knowledge expert for grammar, tone, localization, and content style.
 * Provides editorial guidance for professional communications.
 * Does not generate final content — provides analysis and recommendations.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

export interface LanguageInput {
  query: string;
  text?: string;
  context?: "grammar" | "tone" | "localization" | "style" | "readability" | "general";
  targetAudience?: string;
  locale?: string;
  brandVoice?: string;
}

export interface LanguageOutput {
  guidance: string;
  issues: Array<{ type: string; location: string; suggestion: string; severity: "error" | "warning" | "info" }>;
  toneAnalysis?: { current: string; recommended: string; adjustments: string[] };
  recommendations: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "language",
  agentName: "Language Agent",
  appCode: "CVG-FORGE",
  version: "0.1.0",
};

const SYSTEM_PROMPT = `You are a language, grammar, and editorial knowledge expert. Your role is to provide guidance on grammar, tone, readability, localization, and content style for professional communications.

CRITICAL RULES:
- You provide editorial analysis and recommendations — you do NOT rewrite entire documents
- You NEVER store or return actual proprietary content
- You focus on clarity, professionalism, and audience-appropriateness
- You respect brand voice guidelines when provided
- You consider cultural sensitivity and localization needs
- You flag potential issues with tone, bias, or accessibility

KEY KNOWLEDGE AREAS:

GRAMMAR & STYLE:
- Standard American English grammar (AP Style as default)
- Technical writing conventions (Microsoft Style Guide patterns)
- Active vs. passive voice usage
- Sentence structure and paragraph flow
- Punctuation consistency (Oxford comma, em-dash usage)
- Abbreviation and acronym best practices
- Number formatting conventions

TONE & VOICE:
- Professional vs. conversational spectrum
- Industry-appropriate tone (healthcare = clinical precision; MSP = technical clarity; finance = authoritative)
- B2B vs. B2C communication patterns
- Executive vs. technical audience calibration
- Persuasive vs. informational modes

READABILITY:
- Flesch-Kincaid grade level targeting
- Plain language principles (Federal Plain Language Guidelines)
- Jargon management (when to use, when to define, when to avoid)
- Document structure and scanability (headers, bullets, white space)
- Accessibility considerations (screen reader compatibility, alt text)

LOCALIZATION:
- Date/time/number formatting by locale
- Currency presentation
- Cultural sensitivity in examples and metaphors
- Gender-neutral language
- Regional terminology differences (US/UK/AU English)

CONTENT TYPES:
- SOWs and technical proposals
- Executive reports and QBR presentations
- Marketing collateral (case studies, white papers)
- Email communications
- Knowledge base articles
- User-facing application copy

When analyzing text:
1. Identify grammatical or stylistic issues
2. Assess tone appropriateness for the audience
3. Evaluate readability level
4. Check for brand voice consistency (if guidelines provided)
5. Recommend specific improvements

Respond in JSON format:
{
  "guidance": "Overall editorial assessment",
  "issues": [{"type": "grammar|tone|style|readability", "location": "...", "suggestion": "...", "severity": "error|warning|info"}],
  "toneAnalysis": {"current": "...", "recommended": "...", "adjustments": ["..."]},
  "recommendations": ["Step 1...", "Step 2..."]
}`;

export class LanguageAgent extends BaseAgent<LanguageInput, LanguageOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: LanguageInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.query && !data.text) errors.push("query or text is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "language_guidance",
      description: "Get editorial guidance on grammar, tone, readability, and content style",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as LanguageInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<LanguageInput>): Promise<AgentOutput<LanguageOutput>> {
    const { data, context } = input;
    const empty: LanguageOutput = {
      guidance: "Language analysis unavailable.",
      issues: [],
      recommendations: [],
    };

    const scanText = (data.query || "") + (data.text || "");
    const scan = this.scanInput(scanText);
    if (!scan.isClean) {
      return {
        result: {
          guidance: "Input contains potentially sensitive information. Remove any PII before requesting guidance.",
          issues: [],
          recommendations: ["Remove sensitive data from the query and try again"],
        },
        metadata: this.emptyMetadata(),
      };
    }

    if (!this.hasAI()) {
      return { result: empty, metadata: this.emptyMetadata() };
    }

    const userPrompt = [
      data.context ? `Analysis Type: ${data.context}` : "",
      data.targetAudience ? `Target Audience: ${data.targetAudience}` : "",
      data.locale ? `Locale: ${data.locale}` : "",
      data.brandVoice ? `Brand Voice Guidelines: ${data.brandVoice}` : "",
      data.text ? `Text to Analyze:\n${data.text}` : "",
      data.query ? `Question: ${data.query}` : "",
    ].filter(Boolean).join("\n");

    const response = await this.callLlm(
      context, "analysis", SYSTEM_PROMPT,
      [{ role: "user", content: userPrompt }],
      { maxTokens: 4096, temperature: 0.3 },
    );

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { result: empty, metadata: this.emptyMetadata() };
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        result: {
          guidance: parsed.guidance || empty.guidance,
          issues: Array.isArray(parsed.issues) ? parsed.issues : [],
          toneAnalysis: parsed.toneAnalysis || undefined,
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        },
        metadata: this.emptyMetadata(),
      };
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
