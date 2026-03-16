// @cavaridge/security — Input validation, PII detection, prompt injection prevention

// Types
export type {
  PiiMatch,
  PiiType,
  PiiScanResult,
  InjectionPattern,
  InjectionDetectionResult,
  SecurityScanResult,
  SecurityMiddlewareOptions,
} from "./types.js";

// Sanitization
export { sanitizeString, stripNullBytes, stripHtml, stripControlChars } from "./sanitize.js";

// PII detection
export { scanForPii, redactPii } from "./pii.js";

// Injection detection
export { INJECTION_PATTERNS, detectPromptInjection } from "./injection.js";

// Zod helpers
export {
  safeString,
  noPii,
  noInjection,
  secureUserInput,
  secureAgentInput,
} from "./zod-helpers.js";

// Middleware
export { createSecurityMiddleware } from "./middleware.js";
