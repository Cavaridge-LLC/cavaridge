import type { User, UserRole } from "@shared/schema";
import { isPlatformRole } from "@shared/schema";

export type Permission =
  | "manage_org_settings"
  | "invite_users"
  | "change_roles"
  | "ask_questions"
  | "manage_knowledge"
  | "view_analytics"
  | "manage_platform"
  | "manage_all_orgs"
  | "view_all_orgs"
  | "save_answers"
  | "view_audit_log"
  | "agent_create_plan"
  | "agent_approve_plan"
  | "agent_approve_action"
  | "agent_view_plans";

const ALL_ORG_PERMS: Permission[] = [
  "manage_org_settings", "invite_users", "change_roles",
  "ask_questions", "manage_knowledge", "view_analytics",
  "save_answers", "view_audit_log",
];

const PLATFORM_PERMS: Permission[] = [
  "manage_platform", "manage_all_orgs", "view_all_orgs",
];

const AGENT_WRITE_PERMS: Permission[] = [
  "agent_create_plan", "agent_approve_plan", "agent_approve_action",
];

const AGENT_READ_PERMS: Permission[] = [
  "agent_view_plans",
];

const p = (perms: Permission[]): Set<Permission> => new Set(perms);

const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  platform_owner: p([...ALL_ORG_PERMS, ...PLATFORM_PERMS, ...AGENT_WRITE_PERMS, ...AGENT_READ_PERMS]),
  platform_admin: p([...ALL_ORG_PERMS, "view_all_orgs", ...AGENT_WRITE_PERMS, ...AGENT_READ_PERMS]),
  tenant_admin: p([
    "manage_org_settings", "invite_users", "change_roles",
    "ask_questions", "manage_knowledge", "view_analytics",
    "save_answers", "view_audit_log",
    ...AGENT_WRITE_PERMS, ...AGENT_READ_PERMS,
  ]),
  user: p([
    "ask_questions", "manage_knowledge", "save_answers", "view_analytics",
    ...AGENT_WRITE_PERMS, ...AGENT_READ_PERMS,
  ]),
  viewer: p([
    "ask_questions", ...AGENT_READ_PERMS,
  ]),
};

export function hasPermission(user: User, action: Permission): boolean {
  const role = user.role as UserRole;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.has(action);
}
