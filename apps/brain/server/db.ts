import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as brainSchema from "./db/schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema: brainSchema });
