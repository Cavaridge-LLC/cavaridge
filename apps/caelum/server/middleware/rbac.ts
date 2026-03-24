// Caelum RBAC — delegates to @cavaridge/auth shared guards.
// Local role hierarchy, role cache, and loadUserRole removed in Phase 2.
// The shared createAuthMiddleware (applied globally in server/index.ts)
// loads user profile + role; requireRole from guards checks the hierarchy.

export { requireRole, requireAuth } from "@cavaridge/auth/guards";
export { ROLES } from "@cavaridge/auth";
