/**
 * Tenant isolation middleware.
 * Extracts tenant_id from JWT claims or X-Tenant-Id header (dev only).
 * Every downstream handler receives req.tenantId.
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

export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  // In production, extract from verified JWT via Supabase Auth
  // For now, accept header-based tenant identification (dev mode)
  const tenantId = req.headers['x-tenant-id'] as string;
  const userId = req.headers['x-user-id'] as string;
  const userRole = (req.headers['x-user-role'] as string) ?? 'msp_admin';

  if (!tenantId) {
    res.status(401).json({ error: 'Missing tenant context. Provide X-Tenant-Id header.' });
    return;
  }

  if (!userId) {
    res.status(401).json({ error: 'Missing user context. Provide X-User-Id header.' });
    return;
  }

  req.tenantId = tenantId;
  req.userId = userId;
  req.userRole = userRole;
  next();
}
