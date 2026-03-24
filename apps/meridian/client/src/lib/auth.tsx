import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { SupabaseAuthProvider, useAuth as useSharedAuth, type AuthContextType as SharedAuthContextType } from "@cavaridge/auth/client";
import type { Organization, UserRole } from "@shared/schema";
import { queryClient } from "./queryClient";

// ---------------------------------------------------------------------------
// Meridian permission types (superset of base RBAC)
// ---------------------------------------------------------------------------

export type Permission =
  | "manage_org_settings" | "manage_billing" | "invite_users" | "change_roles"
  | "create_deals" | "edit_deal_metadata" | "delete_deals" | "add_findings"
  | "upload_documents" | "download_documents" | "delete_documents" | "use_chat" | "edit_playbooks"
  | "view_portfolio" | "view_audit_log" | "edit_baselines" | "run_simulations"
  | "manage_platform" | "manage_all_orgs" | "view_all_orgs" | "approve_requests" | "impersonate_org";

export type PlanTier = "starter" | "professional" | "enterprise";

export interface PlanLimits {
  maxUsers: number;
  maxActiveDeals: number;
  maxStorageGb: number;
  maxDocumentsPerDeal: number;
  maxQueriesPerMonth: number;
  portfolioAnalytics: boolean;
  digitalTwinSimulator: boolean;
  maxBaselineProfiles: number;
  auditLogRetentionDays: number;
  whiteLabel: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
}

// ---------------------------------------------------------------------------
// Meridian role → permission map
// ---------------------------------------------------------------------------

function pset(...perms: Permission[]): Set<string> { return new Set(perms); }

const ALL_ORG_PERMS: Permission[] = [
  "manage_org_settings", "manage_billing", "invite_users", "change_roles",
  "create_deals", "edit_deal_metadata", "delete_deals", "add_findings",
  "upload_documents", "download_documents", "delete_documents", "use_chat", "edit_playbooks",
  "view_portfolio", "view_audit_log", "edit_baselines", "run_simulations",
];

const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  platform_admin: pset(
    ...ALL_ORG_PERMS,
    "manage_platform", "manage_all_orgs", "view_all_orgs", "approve_requests", "impersonate_org",
  ),
  msp_admin: pset(
    "manage_org_settings", "manage_billing", "invite_users", "change_roles",
    "create_deals", "edit_deal_metadata", "delete_deals", "add_findings",
    "upload_documents", "download_documents", "delete_documents", "use_chat", "edit_playbooks",
    "view_portfolio", "view_audit_log", "edit_baselines", "run_simulations",
  ),
  msp_tech: pset(
    "create_deals", "edit_deal_metadata", "add_findings", "upload_documents",
    "download_documents", "delete_documents", "use_chat", "edit_playbooks", "view_portfolio",
    "run_simulations",
  ),
  client_admin: pset(
    "download_documents", "use_chat", "view_portfolio",
  ),
  client_viewer: pset("download_documents", "use_chat"),
  prospect: pset(),
};

export function isPlatformRole(role: string): boolean {
  return role === "platform_admin";
}

// ---------------------------------------------------------------------------
// Meridian-extended auth context (adds planTier, planLimits, switchOrg, etc.)
// ---------------------------------------------------------------------------

interface MeridianAuthContextType {
  user: { id: string; email: string; name: string; displayName: string; role: string; avatarUrl: string | null; organizationId: string | null; isPlatformUser: boolean | null; status: string } | null;
  organization: Organization | null;
  planTier: PlanTier;
  planLimits: PlanLimits | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPlatformUser: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, organizationName?: string, industryDefault?: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  hasPermission: (action: Permission) => boolean;
  hasPlanFeature: (feature: keyof PlanLimits) => boolean;
  switchOrg: (orgId: string | null) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const MeridianAuthContext = createContext<MeridianAuthContextType | null>(null);

// ---------------------------------------------------------------------------
// Inner provider that wraps shared auth with Meridian extensions
// ---------------------------------------------------------------------------

function MeridianAuthInner({ children }: { children: ReactNode }) {
  const shared = useSharedAuth();

  // Fetch plan data from the extended endpoint
  const [planTier, setPlanTier] = useState<PlanTier>("starter");
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);

  useEffect(() => {
    if (!shared.isAuthenticated) {
      setPlanTier("starter");
      setPlanLimits(null);
      return;
    }
    fetch("/api/auth/me-ext", { credentials: "include" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setPlanTier((data.planTier || "starter") as PlanTier);
          setPlanLimits(data.planLimits || null);
        }
      })
      .catch(() => {});
  }, [shared.isAuthenticated, shared.profile?.organizationId]);

  const login = useCallback(
    async (email: string, password: string) => {
      await shared.signIn(email, password);
    },
    [shared.signIn],
  );

  const register = useCallback(
    async (email: string, password: string, name: string, organizationName?: string, _industryDefault?: string) => {
      await shared.signUp(email, password, name, organizationName);
    },
    [shared.signUp],
  );

  const logout = useCallback(async () => {
    await shared.signOut();
    queryClient.clear();
  }, [shared.signOut]);

  const switchOrg = useCallback(async (orgId: string | null) => {
    await fetch("/api/platform/switch-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ orgId }),
    });
    // Refetch everything
    window.location.reload();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await shared.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(error.message);
  }, [shared.supabase]);

  const checkPlanFeature = useCallback((feature: keyof PlanLimits): boolean => {
    if (!planLimits) return false;
    const val = planLimits[feature];
    if (typeof val === "boolean") return val;
    return true;
  }, [planLimits]);

  const user = useMemo(() => {
    if (!shared.profile) return null;
    return {
      ...shared.profile,
      name: shared.profile.displayName,
    };
  }, [shared.profile]);

  const value = useMemo<MeridianAuthContextType>(
    () => ({
      user,
      organization: shared.organization as Organization | null,
      planTier,
      planLimits,
      isLoading: shared.isLoading,
      isAuthenticated: shared.isAuthenticated,
      isPlatformUser: shared.isPlatformUser,
      login,
      register,
      logout,
      signInWithGoogle: shared.signInWithGoogle,
      signInWithMicrosoft: shared.signInWithMicrosoft,
      hasPermission: shared.hasPermission as (action: Permission) => boolean,
      hasPlanFeature: checkPlanFeature,
      switchOrg,
      resetPassword,
    }),
    [user, shared, planTier, planLimits, login, register, logout, checkPlanFeature, switchOrg, resetPassword],
  );

  return (
    <MeridianAuthContext.Provider value={value}>
      {children}
    </MeridianAuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Public AuthProvider — wraps SupabaseAuthProvider + MeridianAuthInner
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
      <MeridianAuthInner>{children}</MeridianAuthInner>
    </SupabaseAuthProvider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): MeridianAuthContextType {
  const ctx = useContext(MeridianAuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
