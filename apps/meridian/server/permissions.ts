import type { User, UserRole } from "@shared/schema";
import { isPlatformRole } from "@shared/schema";
import { db } from "./db";
import { dealAccess, deals } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

export type Permission =
  | "manage_org_settings"
  | "manage_billing"
  | "invite_users"
  | "change_roles"
  | "create_deals"
  | "edit_deal_metadata"
  | "delete_deals"
  | "add_findings"
  | "upload_documents"
  | "download_documents"
  | "delete_documents"
  | "use_chat"
  | "edit_playbooks"
  | "view_portfolio"
  | "view_audit_log"
  | "edit_baselines"
  | "run_simulations"
  | "manage_platform"
  | "manage_all_orgs"
  | "view_all_orgs"
  | "approve_requests"
  | "impersonate_org";

const ALL_ORG_PERMS: Permission[] = [
  "manage_org_settings", "manage_billing", "invite_users", "change_roles",
  "create_deals", "edit_deal_metadata", "delete_deals", "add_findings",
  "upload_documents", "download_documents", "delete_documents", "use_chat", "edit_playbooks",
  "view_portfolio", "view_audit_log", "edit_baselines", "run_simulations",
];

const PLATFORM_PERMS: Permission[] = [
  "manage_platform", "manage_all_orgs", "view_all_orgs", "approve_requests", "impersonate_org",
];

const p = (perms: Permission[]): Set<Permission> => new Set(perms);

const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  platform_owner: p([...ALL_ORG_PERMS, ...PLATFORM_PERMS]),
  platform_admin: p([...ALL_ORG_PERMS, "view_all_orgs", "approve_requests", "impersonate_org"]),
  org_owner: p([
    "manage_org_settings", "manage_billing", "invite_users", "change_roles",
    "create_deals", "edit_deal_metadata", "delete_deals", "add_findings",
    "upload_documents", "download_documents", "delete_documents", "use_chat", "edit_playbooks",
    "view_portfolio", "view_audit_log", "edit_baselines", "run_simulations",
  ]),
  org_admin: p([
    "invite_users", "change_roles", "create_deals", "edit_deal_metadata",
    "delete_deals", "add_findings", "upload_documents", "download_documents", "delete_documents",
    "use_chat", "edit_playbooks", "view_portfolio", "view_audit_log",
    "edit_baselines", "run_simulations",
  ]),
  analyst: p([
    "create_deals", "edit_deal_metadata", "add_findings", "upload_documents",
    "download_documents", "delete_documents", "use_chat", "edit_playbooks", "view_portfolio",
    "run_simulations",
  ]),
  integration_pm: p([
    "edit_deal_metadata", "upload_documents", "download_documents", "delete_documents",
    "use_chat", "edit_playbooks", "run_simulations",
  ]),
  viewer: p([
    "download_documents", "use_chat",
  ]),
};

export function hasPermission(user: User, action: Permission): boolean {
  const role = user.role as UserRole;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.has(action);
}

export async function hasAccessToDeal(userId: string, dealId: string, userRole: UserRole): Promise<boolean> {
  if (isPlatformRole(userRole)) return true;
  if (userRole === "org_owner" || userRole === "org_admin") return true;
  if (userRole === "analyst") return true;

  const [access] = await db.select().from(dealAccess)
    .where(and(eq(dealAccess.dealId, dealId), eq(dealAccess.userId, userId)));
  return !!access;
}

export async function getAccessibleDeals(userId: string, orgId: string, role: UserRole) {
  if (isPlatformRole(role)) {
    if (orgId) {
      return db.select().from(deals).where(eq(deals.organizationId, orgId));
    }
    return db.select().from(deals);
  }

  if (role === "org_owner" || role === "org_admin" || role === "analyst") {
    return db.select().from(deals).where(eq(deals.organizationId, orgId));
  }

  const accessRecords = await db.select({ dealId: dealAccess.dealId })
    .from(dealAccess)
    .where(eq(dealAccess.userId, userId));

  const dealIds = accessRecords.map(r => r.dealId).filter((id): id is string => id !== null);
  if (dealIds.length === 0) return [];

  return db.select().from(deals)
    .where(and(eq(deals.organizationId, orgId), inArray(deals.id, dealIds)));
}
