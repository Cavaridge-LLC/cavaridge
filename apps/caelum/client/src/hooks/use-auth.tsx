import { useMemo, type ReactNode } from "react";
import { SupabaseAuthProvider, useAuth as useSharedAuth } from "@cavaridge/auth/client";

// Caelum permission map — mirrors the 5-role RBAC hierarchy
function pset(...perms: string[]): Set<string> { return new Set(perms); }

const ALL_ORG_PERMS = [
  "manage_org_settings", "invite_users", "change_roles",
  "ask_questions", "manage_knowledge", "view_analytics",
  "use_chat", "export_sow",
];

const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  platform_owner: pset(...ALL_ORG_PERMS, "manage_platform", "manage_all_orgs", "view_all_orgs"),
  platform_admin: pset(...ALL_ORG_PERMS, "view_all_orgs"),
  tenant_admin: pset(...ALL_ORG_PERMS),
  user: pset("ask_questions", "use_chat", "export_sow", "manage_knowledge"),
  viewer: pset("ask_questions", "use_chat"),
};

const AUTH_CONFIG = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  rolePermissions: ROLE_PERMISSIONS,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SupabaseAuthProvider config={AUTH_CONFIG}>
      {children}
    </SupabaseAuthProvider>
  );
}

export function useAuth() {
  const shared = useSharedAuth();

  return useMemo(() => ({
    user: shared.profile ? {
      ...shared.profile,
      // backward compat: old Caelum code used firstName/lastName
      firstName: shared.profile.displayName.split(" ")[0] || "",
      lastName: shared.profile.displayName.split(" ").slice(1).join(" ") || "",
      name: shared.profile.displayName,
    } : null,
    isLoading: shared.isLoading,
    isAuthenticated: shared.isAuthenticated,
    isPlatformUser: shared.isPlatformUser,
    login: shared.signIn,
    logout: shared.signOut,
    signInWithGoogle: shared.signInWithGoogle,
    signInWithMicrosoft: shared.signInWithMicrosoft,
    hasPermission: shared.hasPermission,
    isLoggingOut: false,
  }), [shared]);
}
