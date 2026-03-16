/**
 * Prompt injection detection.
 * Scored pattern matching — high weight (0.5), medium (0.3), low (0.1).
 * A score >= 0.5 flags as injection.
 */

import type { InjectionPattern, InjectionDetectionResult } from "./types.js";

export const INJECTION_PATTERNS: InjectionPattern[] = [
  // High confidence (0.5) — direct instruction override attempts
  {
    pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/i,
    label: "instruction_override",
    weight: 0.5,
  },
  {
    pattern: /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i,
    label: "instruction_disregard",
    weight: 0.5,
  },
  {
    pattern: /you\s+are\s+now\s+(a|an|the|in)\b/i,
    label: "role_reassignment",
    weight: 0.5,
  },
  {
    pattern: /new\s+(system\s+)?instructions?:\s/i,
    label: "new_instructions",
    weight: 0.5,
  },
  {
    pattern: /\bsystem\s*:\s/i,
    label: "system_prompt_injection",
    weight: 0.5,
  },

  // Medium confidence (0.3) — suspicious framing
  {
    pattern: /pretend\s+(you\s+are|to\s+be|that)/i,
    label: "pretend_framing",
    weight: 0.3,
  },
  {
    pattern: /act\s+as\s+(if|though|a|an|the)/i,
    label: "act_as_framing",
    weight: 0.3,
  },
  {
    pattern: /forget\s+(everything|all|what)/i,
    label: "forget_command",
    weight: 0.3,
  },
  {
    pattern: /do\s+not\s+follow\s+(any|your|the)\s+(rules?|instructions?|guidelines?)/i,
    label: "rule_bypass",
    weight: 0.3,
  },
  {
    pattern: /\bDAN\b.*\bjailbreak\b|\bjailbreak\b.*\bDAN\b/i,
    label: "jailbreak_reference",
    weight: 0.3,
  },

  // Low confidence (0.1) — weak signals, only matter if combined
  {
    pattern: /\bprompt\s+(injection|leak(ing)?|extract(ion)?)\b/i,
    label: "injection_terminology",
    weight: 0.1,
  },
  {
    pattern: /reveal\s+(your|the|system)\s+(prompt|instructions?|rules?)/i,
    label: "prompt_reveal",
    weight: 0.1,
  },
  {
    pattern: /what\s+(are|is)\s+your\s+(instructions?|system\s+prompt|rules?)/i,
    label: "instruction_probe",
    weight: 0.1,
  },
];

/** Detect prompt injection attempts in text */
export function detectPromptInjection(
  text: string,
  threshold = 0.5,
): InjectionDetectionResult {
  let score = 0;
  const matchedPatterns: string[] = [];

  for (const { pattern, label, weight } of INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      score += weight;
      matchedPatterns.push(label);
    }
  }

  // Cap at 1.0
  score = Math.min(score, 1.0);

  return {
    isInjection: score >= threshold,
    score: Math.round(score * 100) / 100,
    matchedPatterns,
  };
}
