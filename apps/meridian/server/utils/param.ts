/**
 * Narrow Express 5 route parameter to a single string.
 * Express 5 types req.params values as `string | string[]`;
 * named route params always resolve to a single string at runtime.
 */
export function p(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
