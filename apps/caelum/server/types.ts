// Global Express Request augmentation — extends base Request with
// properties set by @cavaridge/auth's createAuthMiddleware.
import type { Profile, Tenant } from "@cavaridge/auth/schema";

declare global {
  namespace Express {
    interface Request {
      user?: Profile;
      tenant?: Tenant;
      tenantId?: string;
      accessibleTenantIds?: string[];
      supabaseUser?: { id: string; email?: string };
      /** @deprecated Use `tenant` */
      org?: Tenant;
      /** @deprecated Use `tenantId` */
      orgId?: string;
    }
  }
}
