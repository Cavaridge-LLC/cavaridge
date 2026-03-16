/**
 * Zod schema helpers with built-in security validation.
 * Composable refinements for sanitization, PII detection, and injection prevention.
 */

import { z } from "zod";
import { sanitizeString } from "./sanitize.js";
import { scanForPii } from "./pii.js";
import { detectPromptInjection } from "./injection.js";

/**
 * Safe string: sanitized, length-limited.
 * Strips HTML, control chars, null bytes.
 */
export function safeString(maxLength = 10000) {
  return z
    .string()
    .max(maxLength)
    .transform((val) => sanitizeString(val, maxLength));
}

/** String that rejects input containing PII */
export function noPii(maxLength = 10000) {
  return safeString(maxLength).refine(
    (val) => !scanForPii(val).hasPii,
    { message: "Input must not contain personally identifiable information" },
  );
}

/** String that rejects prompt injection attempts */
export function noInjection(maxLength = 10000, threshold = 0.5) {
  return safeString(maxLength).refine(
    (val) => !detectPromptInjection(val, threshold).isInjection,
    { message: "Input contains disallowed patterns" },
  );
}

/**
 * Secure user input: sanitized + no PII + no injection.
 * Use for any free-text user input that will be stored or displayed.
 */
export function secureUserInput(maxLength = 10000, injectionThreshold = 0.5) {
  return safeString(maxLength)
    .refine(
      (val) => !scanForPii(val).hasPii,
      { message: "Input must not contain personally identifiable information" },
    )
    .refine(
      (val) => !detectPromptInjection(val, injectionThreshold).isInjection,
      { message: "Input contains disallowed patterns" },
    );
}

/**
 * Secure agent input: sanitized + no injection (PII allowed since agents
 * may legitimately process user data). Stricter injection threshold.
 */
export function secureAgentInput(maxLength = 50000, injectionThreshold = 0.3) {
  return safeString(maxLength).refine(
    (val) => !detectPromptInjection(val, injectionThreshold).isInjection,
    { message: "Input contains disallowed patterns" },
  );
}
