/**
 * CVG-CORE — Database connection
 *
 * Uses Drizzle ORM with postgres.js driver.
 * Connection string from DATABASE_URL env (Doppler in prod).
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

let db: ReturnType<typeof drizzle> | null = null;
let sql: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    sql = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    db = drizzle(sql);
  }

  return db;
}

/** Raw SQL client for queries Drizzle doesn't cover (table stats, RLS checks) */
export function getSql() {
  if (!sql) getDb(); // ensures sql is initialized
  return sql!;
}
