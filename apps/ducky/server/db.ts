import { Pool } from "pg";
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
