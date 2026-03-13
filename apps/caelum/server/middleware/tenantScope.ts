import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { userTenants, tenants } from "@shared/schema";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
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

export async function tenantScope(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = req.user as any;
    if (!user?.id) {
      return next();
    }

    const userId = user.id;

    const [mapping] = await db.select().from(userTenants).where(eq(userTenants.userId, userId));

    if (mapping) {
      req.tenantId = mapping.tenantId;
    } else {
      const defaultId = await getDefaultTenantId();
      req.tenantId = defaultId;

      await db.insert(userTenants).values({ userId, tenantId: defaultId }).onConflictDoNothing();
    }

    next();
  } catch (error) {
    next(error);
  }
}
