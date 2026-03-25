// Re-export canonical auth tables from @cavaridge/auth
export { profiles, tenants, tenantMemberships } from "@cavaridge/auth/schema";
export type { Profile, Tenant } from "@cavaridge/auth/schema";
export type { NewProfile as InsertProfile } from "@cavaridge/auth/schema";

// Backward-compatible aliases
export { profiles as users } from "@cavaridge/auth/schema";
export type { Profile as User } from "@cavaridge/auth/schema";
