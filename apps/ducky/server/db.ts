import { Pool, type PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "@shared/schema";
import path from "path";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

export async function runMigrations() {
  const migrationsFolder = path.resolve(process.cwd(), "drizzle/migrations");
  await migrate(db, { migrationsFolder });
}

/**
 * Execute a callback within a tenant-scoped database session.
 * Sets `app.tenant_id` as a session variable so RLS policies
 * can enforce tenant isolation as defense-in-depth.
 *
 * Note: The primary tenant isolation is via explicit WHERE clauses
 * in Drizzle queries. This helper provides an additional safety net
 * for any raw SQL or future RLS-dependent queries.
 */
export async function withTenantContext<T>(
  tenantId: string,
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("SET LOCAL app.tenant_id = $1", [tenantId]);
    return await callback(client);
  } finally {
    client.release();
  }
}
