import type { Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users, organizations, deals, auditLog } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { User, Organization, UserRole } from "@shared/schema";
import { isPlatformRole } from "@shared/schema";
import { hasPermission, hasAccessToDeal } from "./permissions";

declare module "express-session" {
  interface SessionData {
    userId: string;
    selectedOrgId?: string;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  org?: Organization;
  orgId?: string;
}

const PgSession = connectPgSimple(session);

export function createSessionMiddleware() {
  return session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: (() => {
      const s = process.env.SESSION_SECRET;
      if (!s) throw new Error("SESSION_SECRET environment variable is required");
      return s;
    })(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export async function loadUser(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  if (req.session?.userId) {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
      if (user && user.status === "active") {
        if (isPlatformRole(user.role)) {
          req.user = user;
          const selectedOrgId = req.session.selectedOrgId;
          if (selectedOrgId) {
            const [org] = await db.select().from(organizations)
              .where(eq(organizations.id, selectedOrgId));
            if (org) {
              req.org = org;
              req.orgId = org.id;
            }
          } else if (user.organizationId) {
            const [org] = await db.select().from(organizations)
              .where(eq(organizations.id, user.organizationId));
            if (org) {
              req.org = org;
              req.orgId = org.id;
            }
          }
        } else if (user.organizationId) {
          const [org] = await db.select().from(organizations)
            .where(and(eq(organizations.id, user.organizationId), eq(organizations.isActive, true)));
          if (org) {
            req.user = user;
            req.org = org;
            req.orgId = org.id;
          }
        }
      }
    } catch (err) {
      console.error("loadUser error:", err);
    }
  }
  next();
}

export function requirePermissionMiddleware(action: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!hasPermission(req.user, action as any)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

export function requirePlatformRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (!isPlatformRole(req.user.role)) {
    return res.status(403).json({ message: "Platform access required" });
  }
  next();
}

export function requirePlatformOwner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (req.user.role !== "platform_owner") {
    return res.status(403).json({ message: "Platform owner access required" });
  }
  next();
}

export async function verifyDealAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const dealId = req.params.id || req.params.dealId;
  if (!dealId || !req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (isPlatformRole(req.user.role)) {
    return next();
  }

  if (!req.orgId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const [deal] = await db.select().from(deals)
    .where(eq(deals.id, dealId));

  if (!deal || deal.organizationId !== req.orgId) {
    return res.status(404).json({ message: "Deal not found" });
  }

  const role = req.user.role as UserRole;
  const canAccess = await hasAccessToDeal(req.user.id, deal.id, role);
  if (!canAccess) {
    return res.status(403).json({ message: "Access denied to this deal" });
  }

  next();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function logAudit(
  orgId: string,
  userId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: Record<string, any>,
  ipAddress?: string,
) {
  try {
    await db.insert(auditLog).values({
      organizationId: orgId,
      userId,
      action,
      resourceType,
      resourceId: resourceId || null,
      detailsJson: details || {},
      ipAddress: ipAddress || null,
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
}
