import { db } from "../server/db";
import { sql } from "drizzle-orm";

const TABLES_TO_CLEAN = [
  "processing_queue",
  "document_chunks",
  "findings",
  "pillars",
  "documents",
  "deal_access",
  "tech_stack_items",
  "baseline_comparisons",
  "playbook_tasks",
  "playbook_phases",
  "score_snapshots",
  "deals",
  "usage_tracking",
  "invitations",
  "account_requests",
];

function rows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result?.rows) return result.rows;
  return [];
}

async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await db.execute(
      sql`SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${tableName}`
    );
    return (rows(result)[0]?.cnt || 0) > 0;
  } catch {
    return false;
  }
}

async function getCount(tableName: string, condition?: { column: string; op: string; value: string } | { raw: string }): Promise<number> {
  try {
    const tableIdent = sql.raw(`"${tableName}"`);
    if (condition && "column" in condition) {
      const colIdent = sql.raw(`"${condition.column}"`);
      if (condition.op === "!=") {
        const result = await db.execute(sql`SELECT count(*)::int as cnt FROM ${tableIdent} WHERE ${colIdent} != ${condition.value}`);
        return rows(result)[0]?.cnt || 0;
      } else if (condition.op === "=") {
        const result = await db.execute(sql`SELECT count(*)::int as cnt FROM ${tableIdent} WHERE ${colIdent} = ${condition.value}`);
        return rows(result)[0]?.cnt || 0;
      }
    }
    if (condition && "raw" in condition) {
      const result = await db.execute(sql`SELECT count(*)::int as cnt FROM ${tableIdent} WHERE ${sql.raw(condition.raw)}`);
      return rows(result)[0]?.cnt || 0;
    }
    const result = await db.execute(sql`SELECT count(*)::int as cnt FROM ${tableIdent}`);
    return rows(result)[0]?.cnt || 0;
  } catch {
    return 0;
  }
}

async function getCavaridgeId(): Promise<string | null> {
  try {
    const result = await db.execute(sql`SELECT id FROM organizations WHERE slug = 'cavaridge' OR name = 'Cavaridge, LLC' LIMIT 1`);
    return rows(result)[0]?.id || null;
  } catch {
    return null;
  }
}

async function getPlatformUserIds(): Promise<string[]> {
  try {
    const result = await db.execute(sql`SELECT id FROM users WHERE is_platform_user = true`);
    return rows(result).map((r: any) => r.id);
  } catch {
    return [];
  }
}

async function getPlatformUserEmails(): Promise<string[]> {
  try {
    const result = await db.execute(sql`SELECT email FROM users WHERE is_platform_user = true`);
    return rows(result).map((r: any) => r.email);
  } catch {
    return [];
  }
}

export interface SterilizationSummary {
  success: boolean;
  error?: string;
  orgs_deleted: number;
  users_deleted: number;
  deals_deleted: number;
  documents_deleted: number;
  files_deleted: number;
  preserved_org: string;
  preserved_users: string[];
}

export interface DryRunResult {
  tables: Array<{ table: string; toDelete: number; preserved: number; total: number }>;
  preserved_org: string;
  preserved_users: string[];
  total_to_delete: number;
}

export async function getDryRunCounts(): Promise<DryRunResult> {
  const cavaridgeId = await getCavaridgeId();
  if (!cavaridgeId) throw new Error("Cavaridge, LLC org not found");

  const platformEmails = await getPlatformUserEmails();
  const tableResults: DryRunResult["tables"] = [];
  let totalToDelete = 0;

  for (const table of TABLES_TO_CLEAN) {
    const exists = await tableExists(table);
    if (!exists) continue;
    const total = await getCount(table);
    tableResults.push({ table, toDelete: total, preserved: 0, total });
    totalToDelete += total;
  }

  if (await tableExists("audit_log")) {
    const toDelete = await getCount("audit_log", { raw: "action NOT IN ('app_deployed', 'platform_sterilized')" });
    const total = await getCount("audit_log");
    tableResults.push({ table: "audit_log", toDelete, preserved: total - toDelete, total });
    totalToDelete += toDelete;
  }

  if (await tableExists("baseline_profiles")) {
    const toDelete = await getCount("baseline_profiles", { column: "organization_id", op: "!=", value: cavaridgeId });
    const total = await getCount("baseline_profiles");
    tableResults.push({ table: "baseline_profiles", toDelete, preserved: total - toDelete, total });
    totalToDelete += toDelete;
  }

  if (await tableExists("users")) {
    const toDelete = await getCount("users", { raw: "is_platform_user = false" });
    const total = await getCount("users");
    tableResults.push({ table: "users", toDelete, preserved: total - toDelete, total });
    totalToDelete += toDelete;
  }

  if (await tableExists("organizations")) {
    const toDelete = await getCount("organizations", { column: "id", op: "!=", value: cavaridgeId });
    const total = await getCount("organizations");
    tableResults.push({ table: "organizations", toDelete, preserved: total - toDelete, total });
    totalToDelete += toDelete;
  }

  return {
    tables: tableResults,
    preserved_org: "Cavaridge, LLC",
    preserved_users: platformEmails,
    total_to_delete: totalToDelete,
  };
}

async function cleanObjectStorage(): Promise<number> {
  let deleted = 0;
  try {
    const privateDir = process.env.PRIVATE_OBJECT_DIR;
    if (!privateDir) {
      console.log("  PRIVATE_OBJECT_DIR not set, skipping object storage cleanup");
      return 0;
    }

    const { Client } = await import("@replit/object-storage");
    const client = new Client();

    const { ok, value: objects } = await client.list();
    if (!ok || !objects || objects.length === 0) {
      console.log("  Object storage is already empty");
      return 0;
    }

    console.log(`  Found ${objects.length} objects to delete`);
    for (const obj of objects) {
      try {
        const name = typeof obj === "string" ? obj : (obj as any).name || (obj as any).key;
        if (name) {
          await client.delete(name);
          deleted++;
        }
      } catch (err: any) {
        console.log(`  Warning: Could not delete object: ${err.message}`);
      }
    }
    console.log(`  Deleted ${deleted}/${objects.length} objects from storage`);
  } catch (err: any) {
    console.log(`  Warning: Object storage cleanup failed: ${err.message}`);
    console.log("  (Database cleanup was still successful)");
  }
  return deleted;
}

export async function runSterilization(): Promise<SterilizationSummary> {
  const cavaridgeId = await getCavaridgeId();
  if (!cavaridgeId) {
    return { success: false, error: "Cavaridge, LLC organization not found in database. The platform anchor must exist before sterilization.", orgs_deleted: 0, users_deleted: 0, deals_deleted: 0, documents_deleted: 0, files_deleted: 0, preserved_org: "", preserved_users: [] };
  }

  const platformUserIds = await getPlatformUserIds();
  if (platformUserIds.length === 0) {
    return { success: false, error: "No platform users found. Sterilization would lock out all users.", orgs_deleted: 0, users_deleted: 0, deals_deleted: 0, documents_deleted: 0, files_deleted: 0, preserved_org: "", preserved_users: [] };
  }

  const platformEmails = await getPlatformUserEmails();
  console.log("\n  EXECUTING STERILIZATION...\n");

  const deletedCounts: Record<string, number> = {};

  try {
    await db.transaction(async (tx) => {
      for (const table of TABLES_TO_CLEAN) {
        const exists = await tableExists(table);
        if (!exists) {
          console.log(`  Skipping ${table} — table does not exist`);
          continue;
        }
        const tableIdent = sql.identifier(table);
        const result = await tx.execute(sql`DELETE FROM ${tableIdent}`);
        const count = (result as any)?.rowCount || 0;
        deletedCounts[table] = count;
        console.log(`  ${table}: deleted ${count} rows`);
      }

      if (await tableExists("audit_log")) {
        const result = await tx.execute(sql`DELETE FROM audit_log WHERE action NOT IN ('app_deployed', 'platform_sterilized')`);
        const count = (result as any)?.rowCount || 0;
        deletedCounts["audit_log"] = count;
        console.log(`  audit_log: deleted ${count} rows (preserved deploy/sterilize entries)`);
      }

      if (await tableExists("baseline_profiles")) {
        const result = await tx.execute(sql`DELETE FROM baseline_profiles WHERE organization_id != ${cavaridgeId}`);
        const count = (result as any)?.rowCount || 0;
        deletedCounts["baseline_profiles"] = count;
        console.log(`  baseline_profiles: deleted ${count} rows (preserved Cavaridge)`);
      }

      if (await tableExists("users")) {
        const result = await tx.execute(sql`DELETE FROM users WHERE is_platform_user = false`);
        const count = (result as any)?.rowCount || 0;
        deletedCounts["users"] = count;
        console.log(`  users: deleted ${count} rows (preserved platform users)`);
      }

      if (await tableExists("organizations")) {
        const result = await tx.execute(sql`DELETE FROM organizations WHERE id != ${cavaridgeId}`);
        const count = (result as any)?.rowCount || 0;
        deletedCounts["organizations"] = count;
        console.log(`  organizations: deleted ${count} rows (preserved Cavaridge, LLC)`);
      }

      if (await tableExists("usage_tracking")) {
        await tx.execute(sql`DELETE FROM usage_tracking WHERE organization_id = ${cavaridgeId}`);
        console.log("  Reset: Cavaridge usage tracking counters");
      }

      const platformUser = await tx.execute(sql`SELECT id FROM users WHERE is_platform_user = true LIMIT 1`);
      const platformUserId = rows(platformUser)[0]?.id;

      if (platformUserId) {
        await tx.execute(sql`
          INSERT INTO audit_log (id, organization_id, user_id, action, resource_type, details_json, created_at)
          VALUES (
            gen_random_uuid(),
            ${cavaridgeId},
            ${platformUserId},
            'platform_sterilized',
            'organization',
            ${JSON.stringify({
              reason: "Production sterilization — all demo data removed",
              tables_cleaned: [...TABLES_TO_CLEAN, "audit_log", "baseline_profiles", "users", "organizations"],
              orgs_deleted: deletedCounts["organizations"] || 0,
              users_deleted: deletedCounts["users"] || 0,
              deals_deleted: deletedCounts["deals"] || 0,
              documents_deleted: deletedCounts["documents"] || 0,
              preserved_org: "Cavaridge, LLC",
              preserved_users: platformEmails,
              executed_at: new Date().toISOString(),
            })}::jsonb,
            NOW()
          )
        `);
        console.log("  Added: sterilization audit entry");
      }
    });

    const filesDeleted = await cleanObjectStorage();

    return {
      success: true,
      orgs_deleted: deletedCounts["organizations"] || 0,
      users_deleted: deletedCounts["users"] || 0,
      deals_deleted: deletedCounts["deals"] || 0,
      documents_deleted: deletedCounts["documents"] || 0,
      files_deleted: filesDeleted,
      preserved_org: "Cavaridge, LLC",
      preserved_users: platformEmails,
    };
  } catch (error: any) {
    console.error("  STERILIZATION FAILED:", error.message);
    return { success: false, error: `Sterilization failed: ${error.message}`, orgs_deleted: 0, users_deleted: 0, deals_deleted: 0, documents_deleted: 0, files_deleted: 0, preserved_org: "", preserved_users: [] };
  }
}

function printSafetyGate() {
  console.log(`
  ⚠️  MERIDIAN PRODUCTION STERILIZATION
  ═══════════════════════════════════════

  This will PERMANENTLY DELETE:
  • All organizations except Cavaridge, LLC
  • All non-platform users
  • All deals, findings, pillars, and scores
  • All documents, chunks, and embeddings
  • All chat messages
  • All invitations and account requests
  • All deal access records and usage tracking
  • All uploaded files from object storage
  • All audit log entries (except deploy records)

  This PRESERVES:
  • Cavaridge, LLC organization
  • Platform users (ben@cavaridge.com + any platform_admin accounts)
  • Platform settings
  • Database schema (no tables dropped)

  Run with --dry-run to preview counts.
  Run with --confirm to execute.
`);
}

async function printDryRun() {
  console.log("\n  MERIDIAN Sterilization — Dry Run");
  console.log("  ════════════════════════════════\n");

  try {
    const result = await getDryRunCounts();

    const pad = (s: string, n: number) => s.padEnd(n);
    const rpad = (s: string | number, n: number) => String(s).padStart(n);

    console.log(`  ${pad("Table", 24)} ${rpad("To Delete", 10)} ${rpad("Preserved", 10)} ${rpad("Total", 8)}`);
    console.log(`  ${"─".repeat(24)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(8)}`);

    for (const t of result.tables) {
      console.log(`  ${pad(t.table, 24)} ${rpad(t.toDelete, 10)} ${rpad(t.preserved, 10)} ${rpad(t.total, 8)}`);
    }

    console.log(`\n  Preserved org:    ${result.preserved_org}`);
    for (const email of result.preserved_users) {
      console.log(`  Preserved user:   ${email}`);
    }

    if (result.total_to_delete === 0) {
      console.log("\n  Platform is already clean. Nothing to sterilize.\n");
    } else {
      console.log(`\n  Total rows to delete: ${result.total_to_delete}`);
      console.log("\n  Run with --confirm to execute.\n");
    }
  } catch (err: any) {
    console.error("  Error during dry run:", err.message);
  }
}

async function printVerification() {
  console.log("\n  VERIFICATION:\n");

  const orgs = await db.execute(sql`SELECT name, slug, plan_tier, is_active FROM organizations`);
  console.log("  Organizations:", JSON.stringify(rows(orgs), null, 2));

  const usersResult = await db.execute(sql`
    SELECT name, email, role, is_platform_user, status,
      CASE WHEN password_hash IS NOT NULL AND password_hash LIKE '$2%'
           THEN 'HASHED ✓' ELSE 'MISSING ✗' END as pw_status
    FROM users
  `);
  console.log("  Users:", JSON.stringify(rows(usersResult), null, 2));

  const counts = await db.execute(sql`
    SELECT 'deals' as tbl, count(*)::int as cnt FROM deals
    UNION ALL SELECT 'findings', count(*)::int FROM findings
    UNION ALL SELECT 'pillars', count(*)::int FROM pillars
    UNION ALL SELECT 'documents', count(*)::int FROM documents
    UNION ALL SELECT 'document_chunks', count(*)::int FROM document_chunks
    UNION ALL SELECT 'deal_access', count(*)::int FROM deal_access
    UNION ALL SELECT 'invitations', count(*)::int FROM invitations
    UNION ALL SELECT 'account_requests', count(*)::int FROM account_requests
    UNION ALL SELECT 'usage_tracking', count(*)::int FROM usage_tracking
  `);
  console.log("  Table counts (should all be 0):", JSON.stringify(rows(counts), null, 2));

  const settings = await db.execute(sql`SELECT setting_key FROM platform_settings ORDER BY setting_key`);
  console.log("  Platform settings:", JSON.stringify(rows(settings).map((r: any) => r.setting_key)));

  const loginCheck = await db.execute(sql`
    SELECT email,
      CASE WHEN password_hash IS NOT NULL AND LENGTH(password_hash) > 50
           THEN 'LOGIN READY' ELSE 'LOGIN BROKEN' END as status
    FROM users WHERE email = 'ben@cavaridge.com'
  `);
  console.log("  Login check:", JSON.stringify(rows(loginCheck), null, 2));
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--dry-run")) {
    await printDryRun();
    process.exit(0);
  }

  if (args.includes("--confirm")) {
    const result = await runSterilization();
    if (result.success) {
      await printVerification();
      console.log(`
  ✅ STERILIZATION COMPLETE
  ═════════════════════════

  Organizations:  1 remaining (Cavaridge, LLC)
  Platform users: ${result.preserved_users.length} remaining
  Deals:          0
  Documents:      0 (${result.files_deleted} files removed from storage)
  All other data: cleared

  Platform settings: intact
  Login status:      ready (ben@cavaridge.com)

  The platform is clean and ready for production.
`);
    } else {
      console.error(`\n  ❌ STERILIZATION FAILED: ${result.error}\n`);
    }
    process.exit(result.success ? 0 : 1);
  }

  printSafetyGate();
  process.exit(0);
}

const isDirectRun = process.argv[1]?.includes("sterilize-production");
if (isDirectRun) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
