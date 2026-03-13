/**
 * Spaniel LLM Gateway — Database Client
 *
 * Lazy-initialized Drizzle client for the spaniel schema.
 * Uses DATABASE_URL from environment (same Supabase project).
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;

  const url = process.env.SPANIEL_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "SPANIEL_DATABASE_URL or DATABASE_URL environment variable is required for Spaniel logging."
    );
  }

  const client = postgres(url, { max: 5 });
  _db = drizzle(client, { schema });
  return _db;
}

export function hasDbCapability(): boolean {
  return !!(process.env.SPANIEL_DATABASE_URL || process.env.DATABASE_URL);
}
