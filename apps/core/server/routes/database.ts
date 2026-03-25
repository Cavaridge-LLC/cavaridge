/**
 * Database health routes.
 * Table counts, RLS status, migration history, connection pool info.
 */
import { Router, type Router as RouterType } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { getPool } from '../db';

export const databaseRouter: RouterType = Router();

// Table row counts and sizes
databaseRouter.get('/tables', async (_req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const { rows: tables } = await pool.query(`
      SELECT
        schemaname AS schema,
        relname AS table_name,
        n_live_tup AS row_count,
        pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname)) AS total_size,
        pg_total_relation_size(schemaname || '.' || relname) AS size_bytes
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
    `);
    res.json({ tables, count: tables.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// RLS status per table
databaseRouter.get('/rls', async (_req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const { rows: tables } = await pool.query(`
      SELECT schemaname AS schema, tablename AS table_name, rowsecurity AS rls_enabled
      FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `);

    const { rows: policies } = await pool.query(`
      SELECT schemaname AS schema, tablename AS table_name, policyname AS policy_name,
        permissive, roles, cmd AS command, qual AS using_expr, with_check AS with_check_expr
      FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname
    `);

    const policyMap: Record<string, any[]> = {};
    for (const p of policies) {
      (policyMap[p.table_name] ??= []).push(p);
    }

    const result = tables.map((t: any) => ({
      ...t,
      policies: policyMap[t.table_name] ?? [],
      policy_count: (policyMap[t.table_name] ?? []).length,
    }));

    const rlsEnabled = result.filter((t: any) => t.rls_enabled).length;

    res.json({
      tables: result,
      summary: {
        total: result.length,
        rlsEnabled,
        rlsDisabled: result.length - rlsEnabled,
        totalPolicies: policies.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Migration history
databaseRouter.get('/migrations', async (_req: AuthenticatedRequest, res) => {
  const pool = getPool();
  try {
    const { rows: migrations } = await pool.query('SELECT * FROM drizzle_migrations ORDER BY created_at DESC');
    res.json({ migrations, count: migrations.length });
  } catch {
    try {
      const { rows: migrations } = await pool.query('SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC');
      res.json({ migrations, count: migrations.length });
    } catch {
      res.json({ migrations: [], count: 0, message: 'No migration table found' });
    }
  }
});

// Database extensions
databaseRouter.get('/extensions', async (_req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const { rows: extensions } = await pool.query(`
      SELECT extname AS name, extversion AS version, extnamespace::regnamespace AS schema
      FROM pg_extension ORDER BY extname
    `);
    res.json({ extensions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Overall database health summary
databaseRouter.get('/health', async (_req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const { rows: [stats] } = await pool.query(`
      SELECT
        (SELECT count(*) FROM pg_stat_user_tables) AS table_count,
        (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true) AS rls_enabled_count,
        (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') AS public_table_count,
        (SELECT pg_size_pretty(pg_database_size(current_database()))) AS db_size,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') AS active_connections,
        (SELECT count(*) FROM pg_stat_activity) AS total_connections,
        (SELECT version()) AS pg_version
    `);

    let pgvectorVersion = 'not installed';
    try {
      const { rows } = await pool.query(`SELECT extversion FROM pg_extension WHERE extname = 'vector'`);
      if (rows.length > 0) pgvectorVersion = rows[0].extversion;
    } catch { /* not installed */ }

    res.json({ status: 'healthy', ...stats, pgvector: pgvectorVersion });
  } catch (err: any) {
    res.json({ status: 'error', error: err.message });
  }
});
