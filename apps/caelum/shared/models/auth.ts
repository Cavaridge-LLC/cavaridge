// Re-export canonical auth tables from @cavaridge/auth
export { profiles, tenants, tenantMemberships } from "@cavaridge/auth/schema";
export type { Profile, Tenant, TenantMembership } from "@cavaridge/auth/schema";

// Backward-compatible aliases
export { profiles as users } from "@cavaridge/auth/schema";
export type { Profile as User } from "@cavaridge/auth/schema";

// Legacy alias — tenants was previously called "organizations" in some contexts
export { tenants as organizations } from "@cavaridge/auth/schema";
export type { Tenant as Organization } from "@cavaridge/auth/schema";
