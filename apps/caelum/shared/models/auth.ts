// Re-export canonical auth tables from @cavaridge/auth
export { profiles, tenants, organizations } from "@cavaridge/auth/schema";
export type { Profile, Tenant, Organization } from "@cavaridge/auth/schema";

// Backward-compatible aliases
export { profiles as users } from "@cavaridge/auth/schema";
export type { Profile as User } from "@cavaridge/auth/schema";
