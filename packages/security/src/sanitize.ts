/**
 * Input sanitization utilities.
 * Strips HTML, control characters, null bytes, and enforces length limits.
 */

const HTML_TAG_RE = /<[^>]*>/g;
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const NULL_BYTE_RE = /\0/g;

/** Remove null bytes from a string */
export function stripNullBytes(input: string): string {
  return input.replace(NULL_BYTE_RE, "");
}

/** Strip HTML tags from a string */
export function stripHtml(input: string): string {
  return input.replace(HTML_TAG_RE, "");
}

/** Remove ASCII control characters (except \t, \n, \r) */
export function stripControlChars(input: string): string {
  return input.replace(CONTROL_CHAR_RE, "");
}

/**
 * Full sanitization pipeline:
 * 1. Strip null bytes
 * 2. Strip HTML tags
 * 3. Strip control characters
 * 4. Trim whitespace
 * 5. Enforce max length
 */
export function sanitizeString(input: string, maxLength = 10000): string {
  let result = input;
  result = stripNullBytes(result);
  result = stripHtml(result);
  result = stripControlChars(result);
  result = result.trim();
  if (result.length > maxLength) {
    result = result.slice(0, maxLength);
  }
  return result;
}
