import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { userTenants, tenants } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      /** The resolved tenant type (platform, msp, client, site, prospect) */
      tenantType?: string;
      /** The MSP tenant ID that owns this tenant (for client/site scopes) */
      mspTenantId?: string;
    }
  }
}

const DEFAULT_TENANT_SLUG = "dedicated-it";

let defaultTenantIdCache: string | null = null;

async function getDefaultTenantId(): Promise<string> {
  if (defaultTenantIdCache) return defaultTenantIdCache;
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, DEFAULT_TENANT_SLUG));
  if (!tenant) throw new Error(`Default tenant '${DEFAULT_TENANT_SLUG}' not found. Run seed first.`);
  defaultTenantIdCache = tenant.id;
  return tenant.id;
}

/**
 * Resolves the MSP ancestor for a given tenant by walking up the parent chain.
 * Returns null if the tenant itself is platform-level or has no MSP ancestor.
 */
async function resolveMspTenantId(tenantId: string): Promise<string | null> {
  const result = await db.execute(sql`
    WITH RECURSIVE tenant_chain AS (
      SELECT id, parent_id, type FROM tenants WHERE id = ${tenantId}
      UNION ALL
      SELECT t.id, t.parent_id, t.type
      FROM tenants t
      INNER JOIN tenant_chain tc ON tc.parent_id = t.id
    )
    SELECT id FROM tenant_chain WHERE type = 'msp' LIMIT 1
  `);
  const rows = result.rows as { id: string }[];
  return rows[0]?.id ?? null;
}

/**
 * Middleware that resolves the authenticated user's tenant context.
 *
 * Populates req.tenantId, req.tenantType, and req.mspTenantId.
 * Falls back to the default "dedicated-it" tenant for unmapped users.
 */
export async function tenantScope(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = req.user as any;
    if (!user?.id) {
      return next();
    }

    const userId = user.id;

    const [mapping] = await db.select().from(userTenants).where(eq(userTenants.userId, userId));

    let tenantId: string;
    if (mapping) {
      tenantId = mapping.tenantId;
    } else {
      tenantId = await getDefaultTenantId();
      await db.insert(userTenants).values({ userId, tenantId }).onConflictDoNothing();
    }

    req.tenantId = tenantId;

    // Resolve tenant type and MSP ancestor for UTM-aware routing
    const [tenant] = await db.select({ type: tenants.type }).from(tenants).where(eq(tenants.id, tenantId));
    if (tenant) {
      req.tenantType = tenant.type;
      if (tenant.type === "client" || tenant.type === "site") {
        req.mspTenantId = await resolveMspTenantId(tenantId) ?? undefined;
      } else if (tenant.type === "msp") {
        req.mspTenantId = tenantId;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}
