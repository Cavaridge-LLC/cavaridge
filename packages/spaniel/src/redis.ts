/**
 * Spaniel LLM Gateway — Redis Client
 *
 * Lazy-initialized Redis connection for caching, rate limiting, and BullMQ.
 * Uses REDIS_URL from environment.
 */

import Redis from "ioredis";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL environment variable is required for Redis connectivity.");
  }

  _redis = new Redis(url, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  });

  _redis.on("error", (err) => {
    console.warn("[spaniel] Redis connection error:", err.message);
  });

  void _redis.connect();
  return _redis;
}

export function hasRedisCapability(): boolean {
  return !!process.env.REDIS_URL;
}

export function closeRedis(): void {
  if (_redis) {
    void _redis.quit();
    _redis = null;
  }
}
