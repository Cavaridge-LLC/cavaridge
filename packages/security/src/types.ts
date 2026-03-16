/** PII detection types */

export interface PiiMatch {
  type: PiiType;
  value: string;
  index: number;
  length: number;
}

export type PiiType = "ssn" | "credit_card" | "email" | "phone" | "ip_address";

export interface PiiScanResult {
  hasPii: boolean;
  matches: PiiMatch[];
}

/** Prompt injection detection types */

export interface InjectionPattern {
  pattern: RegExp;
  label: string;
  weight: number;
}

export interface InjectionDetectionResult {
  isInjection: boolean;
  score: number;
  matchedPatterns: string[];
}

/** Combined security scan */

export interface SecurityScanResult {
  pii: PiiScanResult;
  injection: InjectionDetectionResult;
  isClean: boolean;
}

/** Middleware options */

export interface SecurityMiddlewareOptions {
  /** Block requests containing PII (default: true) */
  blockPii?: boolean;
  /** Block requests with injection score >= threshold (default: true) */
  blockInjection?: boolean;
  /** Injection score threshold (default: 0.5) */
  injectionThreshold?: number;
  /** Max input length in characters (default: 10000) */
  maxLength?: number;
  /** Fields to scan in request body (default: all string fields) */
  fields?: string[];
  /** Custom handler for blocked requests */
  onBlocked?: (reason: string, req: unknown) => void;
}
