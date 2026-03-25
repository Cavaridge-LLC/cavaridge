/**
 * Per-tenant rate limiting via Redis.
 *
 * Limits are tracked per tenant_id using a sliding window counter in Redis.
 * Falls back to pass-through if Redis is unavailable (graceful degradation).
 */

import type { Response, NextFunction } from "express";
import type { ServiceRequest } from "./auth.js";
import { hasRedisCapability, getRedis } from "@cavaridge/spaniel";
import { logger } from "../logger.js";

interface TenantRateLimitConfig {
  /** Max requests per window */
  maxRequests: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Redis key prefix */
  prefix: string;
}

const DEFAULT_CONFIG: TenantRateLimitConfig = {
  maxRequests: 120,
  windowSeconds: 60,
  prefix: "spaniel:rl",
};

export function tenantRateLimit(config?: Partial<TenantRateLimitConfig>) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return async (req: ServiceRequest, res: Response, next: NextFunction) => {
    // Extract tenant_id from request body or query
    const tenantId =
      (req.body as Record<string, unknown>)?.tenant_id ??
      (req.query.tenant_id as string | undefined);

    if (!tenantId || !hasRedisCapability()) {
      // No tenant context or no Redis — pass through (IP-based limiter still applies)
      return next();
    }

    try {
      const redis = getRedis();
      const key = `${cfg.prefix}:${tenantId}`;
      const now = Math.floor(Date.now() / 1000);
      const windowStart = now - cfg.windowSeconds;

      // Sliding window: remove old entries, add current, count
      const pipeline = redis.pipeline();
      pipeline.zremrangebyscore(key, 0, windowStart);
      pipeline.zadd(key, now, `${now}:${Math.random().toString(36).slice(2, 8)}`);
      pipeline.zcard(key);
      pipeline.expire(key, cfg.windowSeconds + 1);

      const results = await pipeline.exec();
      const count = (results?.[2]?.[1] as number) ?? 0;

      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", cfg.maxRequests);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, cfg.maxRequests - count));
      res.setHeader("X-RateLimit-Reset", now + cfg.windowSeconds);

      if (count > cfg.maxRequests) {
        logger.warn({ tenantId, count, limit: cfg.maxRequests }, "Tenant rate limit exceeded");
        return res.status(429).json({
          error: "Tenant rate limit exceeded",
          retry_after_seconds: cfg.windowSeconds,
        });
      }

      return next();
    } catch (err) {
      // Redis error — don't block requests, just log
      logger.warn(
        { err: err instanceof Error ? err.message : err },
        "Tenant rate limit check failed — passing through"
      );
      return next();
    }
  };
}
