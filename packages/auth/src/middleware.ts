// @cavaridge/auth/middleware — Re-exports for the middleware import path

export {
  createSupabaseServerClient,
  createSupabaseAdminClient,
  createAuthMiddleware,
  requireAuth,
  requirePlatformRole,
  createPermissionMiddleware,
  createAuditLogger,
  type AuthenticatedRequest,
  type SupabaseConfig,
} from "./server.js";

export {
  requirePlatformAdmin,
  requireRole,
  requireTenant,
  requireTenantAccess,
} from "./guards.js";
