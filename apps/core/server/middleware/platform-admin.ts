/**
 * Platform Admin guard middleware.
 * Extracts identity from headers (dev) or JWT (prod).
 * Only platform_admin and platform_owner roles may access CVG-CORE routes.
 */
import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      tenantId: string;
      userId: string;
      userRole: string;
    }
  }
}

const PLATFORM_ROLES = ['platform_admin', 'platform_owner'];

export function platformAdminMiddleware(req: Request, res: Response, next: NextFunction): void {
  // In production, extract from verified JWT via Supabase Auth
  // For now, accept header-based identification (dev mode)
  const userId = req.headers['x-user-id'] as string;
  const userRole = req.headers['x-user-role'] as string;

  if (!userId) {
    res.status(401).json({ error: 'Missing user context. Provide X-User-Id header.' });
    return;
  }

  if (!userRole || !PLATFORM_ROLES.includes(userRole)) {
    res.status(403).json({ error: 'Platform Admin role required.' });
    return;
  }

  // Platform admins operate across all tenants — tenantId is optional for scoping
  req.tenantId = (req.headers['x-tenant-id'] as string) ?? 'platform';
  req.userId = userId;
  req.userRole = userRole;
  next();
}
