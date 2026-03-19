import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { SupabaseAuthProvider, useAuth as useSharedAuth } from "@cavaridge/auth/client";
import type { Organization } from "@shared/schema";
import { queryClient } from "./queryClient";

// ---------------------------------------------------------------------------
// Vespar permission types
// ---------------------------------------------------------------------------

export type Permission =
  | "create_projects" | "edit_projects" | "delete_projects"
  | "manage_workloads" | "manage_dependencies"
  | "run_analysis" | "view_analysis"
  | "manage_risks" | "manage_costs"
  | "manage_runbooks" | "approve_runbooks"
  | "view_costs"
  | "manage_org_settings" | "manage_users"
  | "manage_platform" | "view_all_tenants";

// ---------------------------------------------------------------------------
// Vespar role → permission map
// ---------------------------------------------------------------------------

function pset(...perms: Permission[]): Set<string> { return new Set(perms); }

const ALL_ORG_PERMS: Permission[] = [
  "create_projects", "edit_projects", "delete_projects",
  "manage_workloads", "manage_dependencies",
  "run_analysis", "view_analysis",
  "manage_risks", "manage_costs",
  "manage_runbooks", "approve_runbooks",
  "view_costs",
  "manage_org_settings", "manage_users",
];

const ROLE_PERMISSIONS: Record<string, Set<string>> = {
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

// ---------------------------------------------------------------------------
// Vespar auth context
// ---------------------------------------------------------------------------

interface VesparAuthContextType {
  user: { id: string; email: string; name: string; displayName: string; role: string; avatarUrl: string | null; organizationId: string | null; isPlatformUser: boolean | null; status: string } | null;
  organization: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPlatformUser: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, organizationName?: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  hasPermission: (action: Permission) => boolean;
  resetPassword: (email: string) => Promise<void>;
}

const VesparAuthContext = createContext<VesparAuthContextType | null>(null);

function VesparAuthInner({ children }: { children: ReactNode }) {
  const shared = useSharedAuth();

  const login = useCallback(
    async (email: string, password: string) => {
      await shared.signIn(email, password);
    },
    [shared.signIn],
  );

  const register = useCallback(
    async (email: string, password: string, name: string, organizationName?: string) => {
      await shared.signUp(email, password, name, organizationName);
    },
    [shared.signUp],
  );

  const logout = useCallback(async () => {
    await shared.signOut();
    queryClient.clear();
  }, [shared.signOut]);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await shared.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(error.message);
  }, [shared.supabase]);

  const user = useMemo(() => {
    if (!shared.profile) return null;
    return {
      ...shared.profile,
      name: shared.profile.displayName,
    };
  }, [shared.profile]);

  const value = useMemo<VesparAuthContextType>(
    () => ({
      user,
      organization: shared.organization as Organization | null,
      isLoading: shared.isLoading,
      isAuthenticated: shared.isAuthenticated,
      isPlatformUser: shared.isPlatformUser,
      login,
      register,
      logout,
      signInWithGoogle: shared.signInWithGoogle,
      signInWithMicrosoft: shared.signInWithMicrosoft,
      hasPermission: shared.hasPermission as (action: Permission) => boolean,
      resetPassword,
    }),
    [user, shared, login, register, logout, resetPassword],
  );

  return (
    <VesparAuthContext.Provider value={value}>
      {children}
    </VesparAuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Public AuthProvider
// ---------------------------------------------------------------------------

const AUTH_CONFIG = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  rolePermissions: ROLE_PERMISSIONS,
  meEndpoint: "/api/auth/me",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SupabaseAuthProvider config={AUTH_CONFIG}>
      <VesparAuthInner>{children}</VesparAuthInner>
    </SupabaseAuthProvider>
  );
}

export function useAuth(): VesparAuthContextType {
  const ctx = useContext(VesparAuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
