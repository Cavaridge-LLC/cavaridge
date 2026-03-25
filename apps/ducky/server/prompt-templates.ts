/**
 * Prompt Template Engine — Stored prompt templates per app/task type.
 *
 * Templates support variable interpolation using {{variable}} syntax.
 * Cached in memory (Redis optional) for fast lookups.
 */

import { db } from "./db.js";
import { promptTemplates } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger.js";
import type { PromptTemplate } from "@shared/schema";

// ---------------------------------------------------------------------------
// In-memory cache (TTL: 5 minutes)
// ---------------------------------------------------------------------------

interface CacheEntry {
  templates: PromptTemplate[];
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function cacheKey(tenantId: string, appCode: string, taskType: string): string {
  return `${tenantId}:${appCode}:${taskType}`;
}

export function invalidateTemplateCache(tenantId: string, appCode?: string, taskType?: string): void {
  if (appCode && taskType) {
    cache.delete(cacheKey(tenantId, appCode, taskType));
  } else {
    // Invalidate all entries for this tenant
    const keys = Array.from(cache.keys());
    for (const key of keys) {
      if (key.startsWith(tenantId)) {
        cache.delete(key);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Variable interpolation
// ---------------------------------------------------------------------------

/**
 * Interpolate {{variable}} placeholders in a template string.
 * Unmatched variables are left as-is.
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName: string) => {
    return variables[varName] ?? match;
  });
}

/**
 * Extract variable names from a template string.
 */
export function extractVariables(template: string): string[] {
  const vars: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  const re = /\{\{(\w+)\}\}/g;
  while ((match = re.exec(template)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      vars.push(match[1]);
    }
  }
  return vars;
}

// ---------------------------------------------------------------------------
// Template resolution
// ---------------------------------------------------------------------------

/**
 * Find the best matching template for a given app + task type.
 * Checks tenant-specific first, then falls back to default.
 */
export async function resolveTemplate(
  tenantId: string,
  appCode: string,
  taskType: string,
): Promise<PromptTemplate | null> {
  const key = cacheKey(tenantId, appCode, taskType);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.templates[0] ?? null;
  }

  try {
    // Look for active templates matching app + task type for this tenant
    const templates = await db
      .select()
      .from(promptTemplates)
      .where(
        and(
          eq(promptTemplates.tenantId, tenantId),
          eq(promptTemplates.appCode, appCode),
          eq(promptTemplates.taskType, taskType),
          eq(promptTemplates.isActive, true),
        ),
      );

    cache.set(key, { templates, expiresAt: Date.now() + CACHE_TTL_MS });

    // Prefer non-default (custom) templates over defaults
    const custom = templates.find((t) => !t.isDefault);
    return custom ?? templates[0] ?? null;
  } catch (err) {
    logger.error({ err, tenantId, appCode, taskType }, "Failed to resolve prompt template");
    return null;
  }
}

/**
 * Build a complete system prompt from a template + variables.
 */
export function buildPromptFromTemplate(
  template: PromptTemplate,
  variables: Record<string, string>,
): { system: string; userPrompt?: string } {
  const system = interpolateTemplate(template.systemPrompt, variables);
  const userPrompt = template.userPromptTemplate
    ? interpolateTemplate(template.userPromptTemplate, variables)
    : undefined;

  return { system, userPrompt };
}
