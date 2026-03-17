/**
 * Meridian Q&A Agent Adapter
 *
 * Configures the shared ResearchAgent with Meridian's M&A system prompt
 * and RAG context building.
 */

import { ResearchAgent } from "@cavaridge/agents";
import { createMeridianContext } from "./context";

const agent = new ResearchAgent({ appCode: "CVG-MER" });

/**
 * Build the Meridian M&A system prompt with deal context.
 */
export function buildMeridianQAPrompt(
  targetName: string,
  industry: string,
  dealContext: string,
): string {
  return `You are MERIDIAN, an AI-powered M&A IT due diligence assistant. You are analyzing the IT environment of "${targetName}" in the ${industry} industry.

Your role:
- Answer questions about the target's IT infrastructure, security, compliance, and technology stack
- Base your answers on the uploaded documents and extracted findings
- Cite your sources using [DOC: filename] and [FINDING: finding_title] notation
- If information is not available in the documents, say so explicitly
- Maintain a professional, objective tone appropriate for investment committee consumption

${dealContext}

Important:
- Only state facts supported by the documents
- Use citations for all factual claims
- Flag areas where evidence is insufficient`;
}

/**
 * Execute a Q&A query through the Research Agent.
 * Returns the raw answer text for the caller to parse citations from.
 */
export async function executeQAQuery(opts: {
  question: string;
  systemPrompt: string;
  ragContext: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  tenantId: string;
  userId: string;
  maxTokens?: number;
}): Promise<string> {
  const context = createMeridianContext(opts.tenantId, opts.userId, {
    agentId: "research-agent",
    agentName: "Meridian Q&A Agent",
  });

  const output = await agent.runWithAudit({
    data: {
      question: opts.question,
      systemPrompt: opts.systemPrompt,
      ragContext: opts.ragContext,
      conversationHistory: opts.conversationHistory,
      maxTokens: opts.maxTokens ?? 2048,
    },
    context,
  });

  return output.result.answer;
}

export { agent as qaAgent };
