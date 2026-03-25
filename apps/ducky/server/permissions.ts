import type { Profile } from "@cavaridge/auth/schema";
import type { UserRole } from "@shared/schema";

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
  | "agent_view_plans"
  | "build_create_plan"
  | "build_view_plans"
  | "manage_templates"
  | "app_query";

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

const BUILD_PERMS: Permission[] = [
  "build_create_plan", "build_view_plans",
];

const TEMPLATE_PERMS: Permission[] = [
  "manage_templates",
];

const APP_QUERY_PERMS: Permission[] = [
  "app_query",
];

const p = (perms: Permission[]): Set<Permission> => new Set(perms);

export const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  platform_admin: p([...ALL_ORG_PERMS, ...PLATFORM_PERMS, ...AGENT_WRITE_PERMS, ...AGENT_READ_PERMS, ...BUILD_PERMS, ...TEMPLATE_PERMS, ...APP_QUERY_PERMS]),
  msp_admin: p([
    ...ALL_ORG_PERMS,
    "view_all_orgs",
    ...AGENT_WRITE_PERMS, ...AGENT_READ_PERMS, ...BUILD_PERMS, ...TEMPLATE_PERMS, ...APP_QUERY_PERMS,
  ]),
  msp_tech: p([
    "ask_questions", "manage_knowledge", "save_answers", "view_analytics",
    ...AGENT_WRITE_PERMS, ...AGENT_READ_PERMS, ...BUILD_PERMS, ...APP_QUERY_PERMS,
  ]),
  client_admin: p([
    "manage_org_settings", "invite_users", "change_roles",
    "ask_questions", "manage_knowledge", "view_analytics",
    "save_answers", "view_audit_log",
    ...AGENT_READ_PERMS, "build_view_plans",
  ]),
  client_viewer: p([
    "ask_questions", ...AGENT_READ_PERMS, "build_view_plans",
  ]),
  prospect: p([
    "ask_questions",
  ]),
};

export function hasPermission(user: Profile, action: Permission): boolean {
  const role = user.role as UserRole;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.has(action);
}
