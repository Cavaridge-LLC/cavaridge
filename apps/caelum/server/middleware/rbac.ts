import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { roles, userRoles } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { ForbiddenError } from "../utils/errors";

export const ROLE_NAMES = {
  PLATFORM_OWNER: "Platform Owner",
  PLATFORM_ADMIN: "Platform Admin",
  TENANT_ADMIN: "Tenant Admin",
  USER: "User",
  VIEWER: "Viewer",
} as const;

export type RoleName = typeof ROLE_NAMES[keyof typeof ROLE_NAMES];

const ROLE_HIERARCHY: Record<string, number> = {
  [ROLE_NAMES.PLATFORM_OWNER]: 50,
  [ROLE_NAMES.PLATFORM_ADMIN]: 40,
  [ROLE_NAMES.TENANT_ADMIN]: 30,
  [ROLE_NAMES.USER]: 20,
  [ROLE_NAMES.VIEWER]: 10,
};

declare global {
  namespace Express {
    interface Request {
      userRole?: string;
      userPermissions?: Record<string, boolean>;
    }
  }
}

const roleCache = new Map<string, { roleName: string; permissions: Record<string, boolean> }>();

export async function loadUserRole(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = req.user as any;
    if (!user?.id || !req.tenantId) {
      req.userRole = ROLE_NAMES.VIEWER;
      req.userPermissions = {};
      return next();
    }

    const userId = user.id;
    const cacheKey = `${userId}:${req.tenantId}`;

    if (roleCache.has(cacheKey)) {
      const cached = roleCache.get(cacheKey)!;
      req.userRole = cached.roleName;
      req.userPermissions = cached.permissions;
      return next();
    }

    const [assignment] = await db.select({
      roleName: roles.name,
      permissions: roles.permissions,
    })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(eq(userRoles.userId, userId), eq(userRoles.tenantId, req.tenantId)));

    if (assignment) {
      req.userRole = assignment.roleName;
      req.userPermissions = assignment.permissions as Record<string, boolean>;
      roleCache.set(cacheKey, { roleName: assignment.roleName, permissions: assignment.permissions as Record<string, boolean> });
    } else {
      req.userRole = ROLE_NAMES.USER;
      req.userPermissions = {};
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...allowedRoles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userRole = req.userRole || ROLE_NAMES.VIEWER;
    const userLevel = ROLE_HIERARCHY[userRole] ?? 0;

    const hasAccess = allowedRoles.some((role) => {
      const requiredLevel = ROLE_HIERARCHY[role] ?? 0;
      return userLevel >= requiredLevel;
    });

    if (!hasAccess) {
      return next(new ForbiddenError(`Insufficient permissions. Required: ${allowedRoles.join(" or ")}.`));
    }

    next();
  };
}

export function clearRoleCache() {
  roleCache.clear();
}
