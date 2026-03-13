/**
 * Spaniel LLM Gateway — Multi-Model Consensus Engine
 *
 * Sends a query to primary and secondary models in parallel, then compares
 * responses using a lightweight alignment-scoring prompt on a fast model.
 *
 * Alignment thresholds (per architecture spec):
 *   > 0.90  → return primary, aligned: true
 *   0.70–0.90 → return primary, aligned: false, with divergence notes
 *   < 0.70 → escalate to tertiary tiebreaker, return majority-aligned
 */

import type OpenAI from "openai";
import type {
  ChatMessage,
  ConsensusResult,
  SpanielRequestOptions,
} from "./types.js";
import { createSpanielClient } from "./client.js";

const ALIGNMENT_SCORER_MODEL = "anthropic/claude-haiku-4-5-20251001";

interface ConsensusInput {
  appCode: string;
  system?: string;
  messages: ChatMessage[];
  options?: SpanielRequestOptions;
  primaryModel: string;
  secondaryModel: string;
  tertiaryModel: string | null;
}

interface ModelCallResult {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

interface ConsensusOutput {
  content: string;
  consensus: ConsensusResult;
  modelUsed: string;
  allResults: {
    primary: ModelCallResult;
    secondary: ModelCallResult;
    tertiary?: ModelCallResult;
  };
  totalInputTokens: number;
  totalOutputTokens: number;
}

async function callModel(
  appCode: string,
  model: string,
  system: string | undefined,
  messages: ChatMessage[],
  options?: SpanielRequestOptions
): Promise<ModelCallResult> {
  const client = createSpanielClient(appCode);

  const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (system) {
    allMessages.push({ role: "system", content: system });
  }
  for (const msg of messages) {
    allMessages.push({
      role: msg.role,
      content: msg.content as string,
    } as OpenAI.Chat.ChatCompletionMessageParam);
  }

  const response = await client.chat.completions.create({
    model,
    messages: allMessages,
    max_tokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 0.7,
  });

  return {
    content: response.choices[0]?.message?.content ?? "",
    model,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

async function scoreAlignment(
  appCode: string,
  query: string,
  responseA: string,
  responseB: string
): Promise<{ score: number; notes: string | null }> {
  const client = createSpanielClient(appCode);

  const scoringPrompt = `You are a response alignment scorer. Compare two AI responses to the same query and score their alignment.

Evaluate these dimensions:
1. Factual claims — do they agree on facts?
2. Numerical data — do numbers/statistics match?
3. Conclusions — do they reach the same conclusions?
4. Key recommendations — do they agree on what to do?

Respond with ONLY valid JSON in this exact format:
{"score": <0.0 to 1.0>, "notes": "<brief divergence notes or null if aligned>"}

Where score:
- 1.0 = identical conclusions and facts
- 0.9+ = minor wording differences, same substance
- 0.7-0.9 = some factual or conclusion differences
- <0.7 = significant disagreement on facts or conclusions`;

  const response = await client.chat.completions.create({
    model: ALIGNMENT_SCORER_MODEL,
    messages: [
      { role: "system", content: scoringPrompt },
      {
        role: "user",
        content: `QUERY:\n${query}\n\nRESPONSE A:\n${responseA.slice(0, 3000)}\n\nRESPONSE B:\n${responseB.slice(0, 3000)}`,
      },
    ],
    max_tokens: 256,
    temperature: 0,
  });

  const raw = response.choices[0]?.message?.content ?? "";

  try {
    const parsed = JSON.parse(raw);
    return {
      score: Math.min(1, Math.max(0, Number(parsed.score) || 0)),
      notes: parsed.notes || null,
    };
  } catch {
    // If scoring model returns unparseable output, assume moderate alignment
    return { score: 0.8, notes: "Alignment scoring returned unparseable result" };
  }
}

export async function runConsensus(input: ConsensusInput): Promise<ConsensusOutput> {
  const { appCode, system, messages, options, primaryModel, secondaryModel, tertiaryModel } =
    input;

  // Step 1: Call primary and secondary in parallel
  const [primaryResult, secondaryResult] = await Promise.all([
    callModel(appCode, primaryModel, system, messages, options),
    callModel(appCode, secondaryModel, system, messages, options),
  ]);

  // Step 2: Score alignment
  const query = messages[messages.length - 1]?.content;
  const queryStr = typeof query === "string" ? query : JSON.stringify(query);
  const alignment = await scoreAlignment(
    appCode,
    queryStr,
    primaryResult.content,
    secondaryResult.content
  );

  let totalInput = primaryResult.inputTokens + secondaryResult.inputTokens;
  let totalOutput = primaryResult.outputTokens + secondaryResult.outputTokens;

  // Step 3: Apply threshold logic
  if (alignment.score > 0.9) {
    // High alignment — return primary
    return {
      content: primaryResult.content,
      consensus: {
        aligned: true,
        confidenceScore: alignment.score,
        divergenceNotes: null,
      },
      modelUsed: primaryModel,
      allResults: { primary: primaryResult, secondary: secondaryResult },
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
    };
  }

  if (alignment.score >= 0.7) {
    // Moderate alignment — return primary with divergence notes
    return {
      content: primaryResult.content,
      consensus: {
        aligned: false,
        confidenceScore: alignment.score,
        divergenceNotes: alignment.notes,
      },
      modelUsed: primaryModel,
      allResults: { primary: primaryResult, secondary: secondaryResult },
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
    };
  }

  // Step 4: Low alignment — escalate to tertiary tiebreaker
  if (!tertiaryModel) {
    // No tertiary available — return primary with warning
    return {
      content: primaryResult.content,
      consensus: {
        aligned: false,
        confidenceScore: alignment.score,
        divergenceNotes: alignment.notes ?? "Significant divergence detected, no tertiary model available",
      },
      modelUsed: primaryModel,
      allResults: { primary: primaryResult, secondary: secondaryResult },
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
    };
  }

  const tertiaryResult = await callModel(appCode, tertiaryModel, system, messages, options);
  totalInput += tertiaryResult.inputTokens;
  totalOutput += tertiaryResult.outputTokens;

  // Score tertiary against both primary and secondary
  const [tertiaryVsPrimary, tertiaryVsSecondary] = await Promise.all([
    scoreAlignment(appCode, queryStr, tertiaryResult.content, primaryResult.content),
    scoreAlignment(appCode, queryStr, tertiaryResult.content, secondaryResult.content),
  ]);

  // Return whichever response the tertiary aligns with more
  const primaryAligned = tertiaryVsPrimary.score >= tertiaryVsSecondary.score;
  const winningResult = primaryAligned ? primaryResult : secondaryResult;
  const winningModel = primaryAligned ? primaryModel : secondaryModel;

  return {
    content: winningResult.content,
    consensus: {
      aligned: false,
      confidenceScore: Math.max(tertiaryVsPrimary.score, tertiaryVsSecondary.score),
      divergenceNotes:
        alignment.notes ??
        `Tertiary tiebreaker sided with ${primaryAligned ? "primary" : "secondary"} model`,
    },
    modelUsed: winningModel,
    allResults: { primary: primaryResult, secondary: secondaryResult, tertiary: tertiaryResult },
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
  };
}
