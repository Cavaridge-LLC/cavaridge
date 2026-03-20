/**
 * Spaniel LLM Gateway — Task-Based Model Routing
 *
 * Resolves which primary/secondary/tertiary models to use for a given task type.
 * Reads from Supabase routing_matrix table with in-memory caching (5 min TTL).
 * Falls back to hardcoded defaults if DB is unavailable.
 */

import type { TaskType, RoutingEntry } from "./types.js";
import { hasDbCapability, getDb } from "./db.js";
import { routingMatrix } from "./schema.js";

const DEFAULT_ROUTING: Record<TaskType, Omit<RoutingEntry, "taskType">> = {
  analysis: {
    primary: "anthropic/claude-opus-4-6",
    secondary: "openai/gpt-4o",
    tertiary: "google/gemini-2.5-pro",
  },
  generation: {
    primary: "anthropic/claude-sonnet-4",
    secondary: "openai/gpt-4o",
    tertiary: "google/gemini-2.5-pro",
  },
  summarization: {
    primary: "anthropic/claude-sonnet-4",
    secondary: "openai/gpt-4o",
    tertiary: "google/gemini-2.0-flash",
  },
  extraction: {
    primary: "anthropic/claude-haiku-4.5",
    secondary: "openai/gpt-4o-mini",
    tertiary: "google/gemini-2.0-flash",
  },
  chat: {
    primary: "anthropic/claude-sonnet-4",
    secondary: "openai/gpt-4o-mini",
    tertiary: "google/gemini-2.0-flash",
  },
  code_generation: {
    primary: "anthropic/claude-sonnet-4",
    secondary: "openai/gpt-4o",
    tertiary: "google/gemini-2.5-pro",
  },
  research: {
    primary: "anthropic/claude-opus-4-6",
    secondary: "google/gemini-2.5-pro",
    tertiary: "openai/gpt-4o",
  },
  conversation: {
    primary: "anthropic/claude-sonnet-4",
    secondary: "openai/gpt-4o-mini",
    tertiary: "google/gemini-2.0-flash",
  },
  embeddings: {
    primary: "openai/text-embedding-3-small",
    secondary: "openai/text-embedding-3-large",
    tertiary: null,
  },
  vision: {
    primary: "anthropic/claude-sonnet-4",
    secondary: "openai/gpt-4o",
    tertiary: "google/gemini-2.5-pro",
  },
};

let routingCache: Map<TaskType, RoutingEntry> | null = null;
let routingCacheTime = 0;
const ROUTING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function loadRoutingFromDb(): Promise<Map<TaskType, RoutingEntry>> {
  const map = new Map<TaskType, RoutingEntry>();

  if (!hasDbCapability()) {
    for (const [taskType, entry] of Object.entries(DEFAULT_ROUTING)) {
      map.set(taskType as TaskType, { taskType: taskType as TaskType, ...entry });
    }
    return map;
  }

  try {
    const db = getDb();
    const rows = await db.select().from(routingMatrix);

    for (const row of rows) {
      map.set(row.taskType as TaskType, {
        taskType: row.taskType as TaskType,
        primary: row.primaryModel,
        secondary: row.secondaryModel,
        tertiary: row.tertiaryModel,
      });
    }

    // Fill in any missing task types from defaults
    for (const [taskType, entry] of Object.entries(DEFAULT_ROUTING)) {
      if (!map.has(taskType as TaskType)) {
        map.set(taskType as TaskType, { taskType: taskType as TaskType, ...entry });
      }
    }

    routingCache = map;
    routingCacheTime = Date.now();
    return map;
  } catch (err) {
    console.warn("[spaniel] Routing DB query failed, using defaults:", err instanceof Error ? err.message : err);
    for (const [taskType, entry] of Object.entries(DEFAULT_ROUTING)) {
      map.set(taskType as TaskType, { taskType: taskType as TaskType, ...entry });
    }
    return map;
  }
}

export async function getRoutingForTask(taskType: TaskType): Promise<RoutingEntry> {
  if (routingCache && Date.now() - routingCacheTime < ROUTING_CACHE_TTL) {
    const cached = routingCache.get(taskType);
    if (cached) return cached;
  }

  const routing = await loadRoutingFromDb();
  const entry = routing.get(taskType);

  if (!entry) {
    // Unknown task type — fall back to chat routing
    return {
      taskType,
      ...DEFAULT_ROUTING.chat,
    };
  }

  return entry;
}

export function getDefaultRouting(): Record<TaskType, Omit<RoutingEntry, "taskType">> {
  return { ...DEFAULT_ROUTING };
}
