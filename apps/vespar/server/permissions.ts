// Vespar permission types and role-permission mapping

export type VesparPermission =
  | "create_projects" | "edit_projects" | "delete_projects"
  | "manage_workloads" | "manage_dependencies"
  | "run_analysis" | "view_analysis"
  | "manage_risks" | "manage_costs"
  | "manage_runbooks" | "approve_runbooks"
  | "view_costs"
  | "manage_org_settings" | "manage_users"
  | "manage_platform" | "view_all_tenants";

function pset(...perms: VesparPermission[]): Set<string> {
  return new Set(perms);
}

const ALL_ORG_PERMS: VesparPermission[] = [
  "create_projects", "edit_projects", "delete_projects",
  "manage_workloads", "manage_dependencies",
  "run_analysis", "view_analysis",
  "manage_risks", "manage_costs",
  "manage_runbooks", "approve_runbooks",
  "view_costs",
  "manage_org_settings", "manage_users",
];

export const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  platform_owner: pset(...ALL_ORG_PERMS, "manage_platform", "view_all_tenants"),
  platform_admin: pset(...ALL_ORG_PERMS, "view_all_tenants"),
  tenant_admin: pset(...ALL_ORG_PERMS),
  user: pset(
    "create_projects", "edit_projects",
    "manage_workloads", "manage_dependencies",
    "run_analysis", "view_analysis",
    "manage_risks", "manage_costs",
    "manage_runbooks",
    "view_costs",
  ),
  viewer: pset("view_analysis", "view_costs"),
};

export function hasPermission(role: string, action: VesparPermission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.has(action);
}
