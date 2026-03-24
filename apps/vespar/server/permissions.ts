// Vespar permission types and role-permission mapping (UTM 6-role standard)

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
  platform_admin: pset(...ALL_ORG_PERMS, "manage_platform", "view_all_tenants"),
  msp_admin: pset(...ALL_ORG_PERMS),
  msp_tech: pset(
    "create_projects", "edit_projects",
    "manage_workloads", "manage_dependencies",
    "run_analysis", "view_analysis",
    "manage_risks", "manage_costs",
    "manage_runbooks",
    "view_costs",
  ),
  client_admin: pset("view_analysis", "view_costs"),
  client_viewer: pset("view_analysis", "view_costs"),
  prospect: pset(),
};

export function hasPermission(role: string, action: VesparPermission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.has(action);
}
