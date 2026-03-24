// Caelum auth middleware — delegates entirely to @cavaridge/auth
// Local loadUser removed in Phase 2; shared createAuthMiddleware is applied
// globally in server/index.ts.

export { requireAuth, type AuthenticatedRequest } from "@cavaridge/auth/server";
