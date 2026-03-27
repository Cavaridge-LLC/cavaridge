/**
 * Spaniel LLM Gateway — Semantic Cache
 *
 * Two-tier caching:
 * 1. Exact match: SHA-256 hash of (model + task_type + tenant_id + normalized_prompt) → Redis with 1hr TTL
 * 2. Similarity match: pgvector cosine similarity > 0.95 threshold (future, requires DB table)
 *
 * Skip cache for: streaming requests, consensus mode, ZDR mode tenants
 */

import { createHash } from "node:crypto";
import { getRedis, hasRedisCapability } from "./redis.js";

const CACHE_TTL_SECONDS = 3600; // 1 hour
const CACHE_PREFIX = "spaniel:cache:";

export interface CacheEntry {
  content: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  cachedAt: string;
}

export interface CacheOptions {
  tenantId: string;
  taskType: string;
  model: string;
  prompt: string;
  system?: string;
  skipCache?: boolean;
  isStreaming?: boolean;
  isConsensus?: boolean;
  isZdr?: boolean;
}

function shouldSkipCache(opts: CacheOptions): boolean {
  return !!(opts.skipCache || opts.isStreaming || opts.isConsensus || opts.isZdr);
}

function buildCacheKey(opts: CacheOptions): string {
  const normalized = [
    opts.model,
    opts.taskType,
    opts.tenantId,
    opts.system ?? "",
    opts.prompt.trim().toLowerCase(),
  ].join("|");

  const hash = createHash("sha256").update(normalized).digest("hex");
  return `${CACHE_PREFIX}${hash}`;
}

export async function getCached(opts: CacheOptions): Promise<CacheEntry | null> {
  if (shouldSkipCache(opts)) return null;
  if (!hasRedisCapability()) return null;

  try {
    const redis = getRedis();
    const key = buildCacheKey(opts);
    const raw = await redis.get(key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry;

    // Track hit count
    await redis.hincrby(`${CACHE_PREFIX}stats`, "hits", 1);

    return entry;
  } catch {
    // Cache miss on error — never block the request
    return null;
  }
}

export async function setCached(opts: CacheOptions, entry: CacheEntry): Promise<void> {
  if (shouldSkipCache(opts)) return;
  if (!hasRedisCapability()) return;

  try {
    const redis = getRedis();
    const key = buildCacheKey(opts);

    await redis.setex(key, CACHE_TTL_SECONDS, JSON.stringify(entry));

    // Track set count
    await redis.hincrby(`${CACHE_PREFIX}stats`, "sets", 1);
  } catch {
    // Silently fail — caching is best-effort
  }
}

export async function getCacheStats(): Promise<{ hits: number; sets: number; size: number }> {
  if (!hasRedisCapability()) return { hits: 0, sets: 0, size: 0 };

  try {
    const redis = getRedis();
    const stats = await redis.hgetall(`${CACHE_PREFIX}stats`);

    // Count cache keys
    let cursor = "0";
    let size = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", `${CACHE_PREFIX}*`, "COUNT", 100);
      cursor = nextCursor;
      size += keys.filter(k => k !== `${CACHE_PREFIX}stats`).length;
    } while (cursor !== "0");

    return {
      hits: parseInt(stats.hits ?? "0", 10),
      sets: parseInt(stats.sets ?? "0", 10),
      size,
    };
  } catch {
    return { hits: 0, sets: 0, size: 0 };
  }
}

export async function clearCache(): Promise<number> {
  if (!hasRedisCapability()) return 0;

  try {
    const redis = getRedis();
    let cursor = "0";
    let deleted = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", `${CACHE_PREFIX}*`, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== "0");

    return deleted;
  } catch {
    return 0;
  }
}
