/**
 * CVG-CAVALIER — Database connection
 *
 * Uses Drizzle ORM with postgres.js driver.
 * Connection string from DATABASE_URL env (Doppler in prod).
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql as drizzleSql } from 'drizzle-orm';
import postgres from 'postgres';

let db: ReturnType<typeof drizzle> | null = null;
let sqlClient: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    sqlClient = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    const drizzleDb = drizzle(sqlClient);

    // Wrap execute to support { sql, params } pattern used in route files
    const originalExecute = drizzleDb.execute.bind(drizzleDb);
    (drizzleDb as any).execute = async (queryOrObj: any) => {
      if (queryOrObj && typeof queryOrObj === 'object' && 'sql' in queryOrObj && 'params' in queryOrObj) {
        return sqlClient!.unsafe(queryOrObj.sql, queryOrObj.params);
      }
      return originalExecute(queryOrObj);
    };

    db = drizzleDb;
  }

  return db;
}

/** Get raw postgres.js client for parameterized SQL queries */
export function getSql() {
  if (!sqlClient) {
    getDb(); // Initialize if needed
  }
  return sqlClient!;
}

/**
 * Execute a raw SQL query with parameterized values.
 * Wrapper around postgres.js unsafe() to support the { sql, params } pattern
 * used across Cavalier route files.
 */
export async function executeRaw(query: string, params: unknown[] = []) {
  const client = getSql();
  return client.unsafe(query, params as any[]);
}

export { drizzleSql };
