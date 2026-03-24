/**
 * Service-to-service authentication middleware.
 *
 * Spaniel is not user-facing. Consuming services (Ducky, etc.) authenticate
 * with a bearer token set in SPANIEL_SERVICE_TOKENS (comma-separated list).
 *
 * Uses extractBearerToken from @cavaridge/auth/server for token parsing.
 */

import type { Request, Response, NextFunction } from "express";
import { extractBearerToken } from "@cavaridge/auth/server";
import { logger } from "../logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Extends Express Request with service identity fields set by serviceAuth. */
export interface ServiceRequest extends Request {
  /** Identifier for the calling service (derived from token index) */
  serviceId?: string;
}

// ---------------------------------------------------------------------------
// Token resolution
// ---------------------------------------------------------------------------

function getServiceTokens(): string[] {
  const raw = process.env.SPANIEL_SERVICE_TOKENS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function serviceAuth(req: ServiceRequest, res: Response, next: NextFunction) {
  // Health endpoint is always public
  if (req.path === "/health") {
    return next();
  }

  const tokens = getServiceTokens();

  // Dev bypass: if no tokens configured, allow all requests with warning
  if (tokens.length === 0) {
    if (process.env.NODE_ENV === "production") {
      logger.error("SPANIEL_SERVICE_TOKENS not set in production — rejecting request");
      return res.status(503).json({ error: "Service misconfigured" });
    }
    logger.warn("No SPANIEL_SERVICE_TOKENS set — allowing unauthenticated request (dev only)");
    req.serviceId = "dev-bypass";
    return next();
  }

  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const tokenIndex = tokens.indexOf(token);
  if (tokenIndex === -1) {
    return res.status(403).json({ error: "Invalid service token" });
  }

  // Tag the request with a service identifier (token position)
  req.serviceId = `service-${tokenIndex}`;

  next();
}
