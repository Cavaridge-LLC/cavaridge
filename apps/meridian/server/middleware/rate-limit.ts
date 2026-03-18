import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

const EXEMPT_PATHS = ["/api/version", "/api/system-status"];

function isExempt(path: string): boolean {
  return EXEMPT_PATHS.some(p => path === p);
}

function handler(_req: Request, res: Response) {
  const retryAfter = Math.ceil((res.getHeader("Retry-After") as number) || 60);
  res.status(429).json({ error: "Too many requests", retryAfter });
}

const AUTH_PATHS = ["/api/auth/login", "/api/auth/register"];

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  skip: (req) => {
    // In dev, skip rate limiting for Vite module requests
    if (process.env.NODE_ENV !== "production") {
      if (!req.path.startsWith("/api")) return true;
    }
    return isExempt(req.path) || AUTH_PATHS.some(p => req.path.startsWith(p));
  },
  validate: { xForwardedForHeader: false },
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  validate: { xForwardedForHeader: false },
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  validate: { xForwardedForHeader: false },
});

export const AI_RATE_LIMIT_PATTERNS = [
  "/qa/", "/export/", "/simulate/", "/classify",
  "/embed", "/infra-analysis", "/playbook",
  "/generate-playbook", "/generate-infra",
  "/extract-tech-stack", "/extract-topology",
  "/compare-baseline", "/vision",
];

export function shouldApplyAiLimit(path: string): boolean {
  return AI_RATE_LIMIT_PATTERNS.some(p => path.includes(p));
}
