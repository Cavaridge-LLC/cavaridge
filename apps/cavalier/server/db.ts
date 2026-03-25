/**
 * CVG-CAVALIER — Database connection
 *
 * Uses Drizzle ORM with postgres.js driver.
 * Connection string from DATABASE_URL env (Doppler in prod).
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sqlClient = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

const drizzleDb = drizzle(sqlClient);

// Wrap execute to support { sql, params } pattern used in route files
const originalExecute = drizzleDb.execute.bind(drizzleDb);
(drizzleDb as any).execute = async (queryOrObj: any) => {
  if (queryOrObj && typeof queryOrObj === 'object' && 'sql' in queryOrObj && 'params' in queryOrObj) {
    return sqlClient.unsafe(queryOrObj.sql, queryOrObj.params);
  }
  return originalExecute(queryOrObj);
};

export const db = drizzleDb;

/** Get Drizzle ORM instance */
export function getDb() {
  return db;
}

/** Get raw postgres.js client for parameterized SQL queries */
export function getSql() {
  return sqlClient;
}

/**
 * Execute a raw SQL query with parameterized values.
 */
export async function executeRaw(query: string, params: unknown[] = []) {
  return sqlClient.unsafe(query, params as any[]);
}
