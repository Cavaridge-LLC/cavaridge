// Brain permission types and role-permission mapping (UTM 6-role standard)

export type BrainPermission =
  | "create_recordings" | "view_recordings" | "delete_recordings"
  | "process_transcripts"
  | "view_knowledge" | "edit_knowledge" | "delete_knowledge"
  | "query_recall"
  | "configure_connectors" | "trigger_sync" | "view_connectors"
  | "view_stats"
  | "manage_org_settings" | "manage_users"
  | "manage_platform" | "view_all_tenants";

function pset(...perms: BrainPermission[]): Set<string> {
  return new Set(perms);
}

const ALL_ORG_PERMS: BrainPermission[] = [
  "create_recordings", "view_recordings", "delete_recordings",
  "process_transcripts",
  "view_knowledge", "edit_knowledge", "delete_knowledge",
  "query_recall",
  "configure_connectors", "trigger_sync", "view_connectors",
  "view_stats",
  "manage_org_settings", "manage_users",
];

export const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  platform_admin: pset(...ALL_ORG_PERMS, "manage_platform", "view_all_tenants"),
  msp_admin: pset(...ALL_ORG_PERMS),
  msp_tech: pset(
    "create_recordings", "view_recordings", "delete_recordings",
    "process_transcripts",
    "view_knowledge", "edit_knowledge", "delete_knowledge",
    "query_recall",
    "configure_connectors", "trigger_sync", "view_connectors",
    "view_stats",
  ),
  client_admin: pset("create_recordings", "view_recordings", "process_transcripts", "view_knowledge", "query_recall", "view_connectors", "view_stats"),
  client_viewer: pset("view_recordings", "view_knowledge", "query_recall", "view_stats"),
  prospect: pset(),
};

export function hasPermission(role: string, action: BrainPermission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.has(action);
}
