// Ducky client auth — wraps shared SupabaseAuthProvider with Ducky's config

import { useMemo, type ReactNode } from "react";
import {
  SupabaseAuthProvider,
  useAuth as useSharedAuth,
  useSupabase,
  type AuthProviderConfig,
} from "@cavaridge/auth/client";

// Re-export shared hooks
export { useSupabase };

/**
 * Ducky-specific useAuth wrapper.
 * Maps shared auth's `profile` → `user` and `signOut` → `logout`
 * so existing components don't need changes.
 */
export function useAuth() {
  const shared = useSharedAuth();
  return useMemo(() => ({
    ...shared,
    // Backward-compatible aliases
    user: shared.profile
      ? { ...shared.profile, name: shared.profile.displayName }
      : null,
    login: shared.signIn,
    register: shared.signUp,
    logout: shared.signOut,
  }), [shared]);
}

// Ducky permissions (mirrors server-side permissions.ts)
export type Permission =
  | "manage_org_settings" | "invite_users" | "change_roles"
  | "ask_questions" | "manage_knowledge" | "view_analytics"
  | "manage_platform" | "manage_all_orgs" | "view_all_orgs"
  | "save_answers" | "view_audit_log"
  | "agent_create_plan" | "agent_approve_plan" | "agent_approve_action"
  | "agent_view_plans";

const p = (...perms: Permission[]): Set<string> => new Set(perms);

const ALL_ORG_PERMS: Permission[] = [
  "manage_org_settings", "invite_users", "change_roles",
  "ask_questions", "manage_knowledge", "view_analytics",
  "save_answers", "view_audit_log",
];

const AGENT_WRITE_PERMS: Permission[] = [
  "agent_create_plan", "agent_approve_plan", "agent_approve_action",
];

const AGENT_READ_PERMS: Permission[] = [
  "agent_view_plans",
];

const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  platform_owner: p(
    ...ALL_ORG_PERMS,
    "manage_platform", "manage_all_orgs", "view_all_orgs",
    ...AGENT_WRITE_PERMS, ...AGENT_READ_PERMS,
  ),
  platform_admin: p(
    ...ALL_ORG_PERMS,
    "view_all_orgs",
    ...AGENT_WRITE_PERMS, ...AGENT_READ_PERMS,
  ),
  tenant_admin: p(
    ...ALL_ORG_PERMS,
    ...AGENT_WRITE_PERMS, ...AGENT_READ_PERMS,
  ),
  user: p(
    "ask_questions", "manage_knowledge", "save_answers", "view_analytics",
    ...AGENT_WRITE_PERMS, ...AGENT_READ_PERMS,
  ),
  viewer: p("ask_questions", ...AGENT_READ_PERMS),
};

export function isPlatformRole(role: string): boolean {
  return role === "platform_owner" || role === "platform_admin";
}

// Auth config — reads Supabase keys from Vite env
const authConfig: AuthProviderConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  rolePermissions: ROLE_PERMISSIONS,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SupabaseAuthProvider config={authConfig}>
      {children}
    </SupabaseAuthProvider>
  );
}
