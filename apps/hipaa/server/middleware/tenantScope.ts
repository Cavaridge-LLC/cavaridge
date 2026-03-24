// Tenant scoping is now handled by createAuthMiddleware from @cavaridge/auth/server.
// This file is kept as a no-op for any residual imports.
import type { Request, Response, NextFunction } from "express";

export function tenantScope(_req: Request, _res: Response, next: NextFunction) {
  next();
}
