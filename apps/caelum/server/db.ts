import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

/**
 * Execute a callback within a tenant-scoped database session.
 * Sets app.current_tenant_id so RLS policies enforce tenant isolation.
 */
export async function withTenantContext<T>(
  tenantId: string,
  callback: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("SET LOCAL app.current_tenant_id = $1", [tenantId]);
    return await callback(client);
  } finally {
    client.release();
  }
}
