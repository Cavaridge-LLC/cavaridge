/**
 * PII detection and redaction.
 * Regex-based scanning for SSN, credit cards (with Luhn), email, phone, IP addresses.
 */

import type { PiiMatch, PiiScanResult, PiiType } from "./types.js";

/** Luhn check for credit card validation */
function luhnCheck(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

interface PiiPattern {
  type: PiiType;
  regex: RegExp;
  validate?: (match: string) => boolean;
}

const PII_PATTERNS: PiiPattern[] = [
  {
    type: "ssn",
    // SSN: 123-45-6789 or 123456789 (not starting with 000, 666, or 9xx)
    regex: /\b(?!000|666|9\d{2})([0-8]\d{2})-?(?!00)(\d{2})-?(?!0000)(\d{4})\b/g,
  },
  {
    type: "credit_card",
    // 13-19 digit sequences that may be separated by spaces or dashes
    regex: /\b(\d[ -]*?){13,19}\b/g,
    validate: (match) => {
      const digits = match.replace(/[\s-]/g, "");
      return digits.length >= 13 && digits.length <= 19 && luhnCheck(digits);
    },
  },
  {
    type: "email",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    type: "phone",
    // US phone: (123) 456-7890, 123-456-7890, +1-123-456-7890, etc.
    regex: /\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  },
  {
    type: "ip_address",
    // IPv4 only
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
  },
];

/** Scan text for PII matches */
export function scanForPii(text: string): PiiScanResult {
  const matches: PiiMatch[] = [];

  for (const pattern of PII_PATTERNS) {
    // Reset regex state
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(text)) !== null) {
      const value = match[0];
      if (pattern.validate && !pattern.validate(value)) continue;
      matches.push({
        type: pattern.type,
        value,
        index: match.index,
        length: value.length,
      });
    }
  }

  return {
    hasPii: matches.length > 0,
    matches,
  };
}

/** Redact detected PII in text, replacing with [REDACTED:type] */
export function redactPii(text: string): string {
  const { matches } = scanForPii(text);
  if (matches.length === 0) return text;

  // Sort by index descending so replacements don't shift positions
  const sorted = [...matches].sort((a, b) => b.index - a.index);
  let result = text;
  for (const m of sorted) {
    result =
      result.slice(0, m.index) +
      `[REDACTED:${m.type}]` +
      result.slice(m.index + m.length);
  }
  return result;
}
