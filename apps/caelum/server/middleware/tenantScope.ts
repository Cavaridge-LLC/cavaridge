// Caelum tenant scope — no longer needed as a separate middleware.
// The shared createAuthMiddleware (applied globally in server/index.ts)
// resolves req.tenant, req.tenantId, and req.accessibleTenantIds.
//
// This file is kept as a no-op passthrough for any remaining imports
// during the migration period. It will be removed in a future cleanup.

import type { Request, Response, NextFunction } from "express";

export function tenantScope(_req: Request, _res: Response, next: NextFunction) {
  // No-op: tenant resolution handled by shared auth middleware
  next();
}
