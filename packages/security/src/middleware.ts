/**
 * Express security middleware factory.
 * Scans request body string fields for PII and prompt injection.
 */

import type { Request, Response, NextFunction } from "express";
import type { SecurityMiddlewareOptions } from "./types.js";
import { sanitizeString } from "./sanitize.js";
import { scanForPii } from "./pii.js";
import { detectPromptInjection } from "./injection.js";

/**
 * Creates Express middleware that validates request body fields
 * for PII and prompt injection. Follows the `createAuthMiddleware`
 * pattern from `@cavaridge/auth`.
 */
export function createSecurityMiddleware(options: SecurityMiddlewareOptions = {}) {
  const {
    blockPii = true,
    blockInjection = true,
    injectionThreshold = 0.5,
    maxLength = 10000,
    fields,
    onBlocked,
  } = options;

  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.body || typeof req.body !== "object") {
      next();
      return;
    }

    const fieldsToScan = fields
      ? fields.filter((f) => typeof req.body[f] === "string")
      : Object.keys(req.body).filter((k) => typeof req.body[k] === "string");

    for (const field of fieldsToScan) {
      const raw: string = req.body[field];

      // Sanitize in place
      req.body[field] = sanitizeString(raw, maxLength);
      const value: string = req.body[field];

      // PII check
      if (blockPii) {
        const piiResult = scanForPii(value);
        if (piiResult.hasPii) {
          const reason = `PII detected in field "${field}": ${piiResult.matches.map((m) => m.type).join(", ")}`;
          onBlocked?.(reason, req);
          _res.status(400).json({ error: "Request contains prohibited content", field });
          return;
        }
      }

      // Injection check
      if (blockInjection) {
        const injResult = detectPromptInjection(value, injectionThreshold);
        if (injResult.isInjection) {
          const reason = `Injection detected in field "${field}": score=${injResult.score}`;
          onBlocked?.(reason, req);
          _res.status(400).json({ error: "Request contains prohibited content", field });
          return;
        }
      }
    }

    next();
  };
}
