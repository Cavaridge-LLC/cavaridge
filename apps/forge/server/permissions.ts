// Forge permission types and role-permission mapping (UTM 6-role standard)

export type ForgePermission =
  | "create_projects" | "edit_projects" | "delete_projects"
  | "approve_projects" | "view_projects"
  | "manage_templates"
  | "view_credits" | "manage_credits"
  | "view_usage"
  | "manage_org_settings" | "manage_users"
  | "manage_platform" | "view_all_tenants";

function pset(...perms: ForgePermission[]): Set<string> {
  return new Set(perms);
}

const ALL_ORG_PERMS: ForgePermission[] = [
  "create_projects", "edit_projects", "delete_projects",
  "approve_projects", "view_projects",
  "manage_templates",
  "view_credits", "manage_credits",
  "view_usage",
  "manage_org_settings", "manage_users",
];

export const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  platform_admin: pset(...ALL_ORG_PERMS, "manage_platform", "view_all_tenants"),
  msp_admin: pset(...ALL_ORG_PERMS),
  msp_tech: pset(
    "create_projects", "edit_projects",
    "approve_projects", "view_projects",
    "manage_templates",
    "view_credits", "view_usage",
  ),
  client_admin: pset("view_projects", "view_credits", "view_usage"),
  client_viewer: pset("view_projects"),
  prospect: pset(),
};

export function hasPermission(role: string, action: ForgePermission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.has(action);
}
