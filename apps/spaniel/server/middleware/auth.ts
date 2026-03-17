/**
 * Service-to-service authentication middleware.
 *
 * Spaniel is not user-facing. Consuming services (Ducky, etc.) authenticate
 * with a bearer token set in SPANIEL_SERVICE_TOKENS (comma-separated list).
 *
 * In development, if no tokens are configured, auth is bypassed with a warning.
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "../logger.js";

const HEADER = "authorization";

function getServiceTokens(): string[] {
  const raw = process.env.SPANIEL_SERVICE_TOKENS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function serviceAuth(req: Request, res: Response, next: NextFunction) {
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
    return next();
  }

  const authHeader = req.headers[HEADER];
  if (!authHeader || typeof authHeader !== "string") {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: "Invalid Authorization header format" });
  }

  const token = match[1];
  if (!tokens.includes(token)) {
    return res.status(403).json({ error: "Invalid service token" });
  }

  next();
}
