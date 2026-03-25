// CVG-CAVALIER — Express request augmentation for shared auth
//
// Properties set by @cavaridge/auth middleware (loadUser) and
// the userId compat shim in index.ts.
// All optional to match AuthenticatedRequest in @cavaridge/auth.

import type { Profile, Tenant } from "@cavaridge/auth/schema";

declare global {
  namespace Express {
    interface Request {
      user?: Profile;
      tenant?: Tenant;
      tenantId?: string;
      userId?: string;
      accessibleTenantIds?: string[];
      supabaseUser?: { id: string; email?: string };
    }
  }
}

export {};
