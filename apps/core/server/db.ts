/**
 * CVG-CORE — Database connection
 *
 * Uses Drizzle ORM with node-postgres driver (matches @cavaridge/auth expectations).
 * Connection string from DATABASE_URL env (Doppler in prod).
 *
 * Exports both the Drizzle db instance (for auth middleware) and a raw pool
 * for the pg_stat / pg_tables queries that Drizzle doesn't cover.
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: NodePgDatabase | null = null;

function ensurePool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

export function getDb(): NodePgDatabase {
  if (!db) {
    db = drizzle(ensurePool());
  }
  return db;
}

/** Raw SQL via pool.query for queries Drizzle doesn't cover (table stats, RLS checks) */
export function getPool(): pg.Pool {
  return ensurePool();
}
