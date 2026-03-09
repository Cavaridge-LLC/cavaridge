import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./queryClient";
import type { User, Organization, UserRole } from "@shared/schema";

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

function pset(...perms: Permission[]): Set<Permission> { return new Set(perms); }

const ALL_ORG_PERMS: Permission[] = [
  "manage_org_settings", "manage_billing", "invite_users", "change_roles",
  "create_deals", "edit_deal_metadata", "delete_deals", "add_findings",
  "upload_documents", "download_documents", "delete_documents", "use_chat", "edit_playbooks",
  "view_portfolio", "view_audit_log", "edit_baselines", "run_simulations",
];

const ROLE_PERMISSIONS: Record<string, Set<Permission>> = {
  platform_owner: pset(
    ...ALL_ORG_PERMS,
    "manage_platform", "manage_all_orgs", "view_all_orgs", "approve_requests", "impersonate_org",
  ),
  platform_admin: pset(
    ...ALL_ORG_PERMS,
    "view_all_orgs", "approve_requests", "impersonate_org",
  ),
  org_owner: pset(
    "manage_org_settings", "manage_billing", "invite_users", "change_roles",
    "create_deals", "edit_deal_metadata", "delete_deals", "add_findings",
    "upload_documents", "download_documents", "use_chat", "edit_playbooks",
    "view_portfolio", "view_audit_log", "edit_baselines", "run_simulations",
  ),
  org_admin: pset(
    "invite_users", "change_roles", "create_deals", "edit_deal_metadata",
    "delete_deals", "add_findings", "upload_documents", "download_documents",
    "use_chat", "edit_playbooks", "view_portfolio", "view_audit_log",
    "edit_baselines", "run_simulations",
  ),
  analyst: pset(
    "create_deals", "edit_deal_metadata", "add_findings", "upload_documents",
    "download_documents", "delete_documents", "use_chat", "edit_playbooks", "view_portfolio",
    "run_simulations",
  ),
  integration_pm: pset(
    "edit_deal_metadata", "upload_documents", "download_documents", "delete_documents",
    "use_chat", "edit_playbooks", "run_simulations",
  ),
  viewer: pset("download_documents", "use_chat"),
};

export function isPlatformRole(role: string): boolean {
  return role === "platform_owner" || role === "platform_admin";
}

interface AuthContextType {
  user: (Omit<User, "passwordHash">) | null;
  organization: Organization | null;
  planTier: PlanTier;
  planLimits: PlanLimits | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPlatformUser: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, organizationName?: string, industryDefault?: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (action: Permission) => boolean;
  hasPlanFeature: (feature: keyof PlanLimits) => boolean;
  switchOrg: (orgId: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery<{ user: Omit<User, "passwordHash">; organization: Organization; planTier?: PlanTier; planLimits?: PlanLimits } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; name: string; organizationName?: string; industryDefault?: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.clear();
    },
  });

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const register = async (email: string, password: string, name: string, organizationName?: string, industryDefault?: string) => {
    await registerMutation.mutateAsync({ email, password, name, organizationName, industryDefault });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const switchOrg = async (orgId: string | null) => {
    await apiRequest("POST", "/api/platform/switch-org", { orgId });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
    queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stats"] });
  };

  const userRole = data?.user?.role || "";
  const currentPlanTier = (data?.planTier || "starter") as PlanTier;
  const currentPlanLimits = data?.planLimits || null;

  const checkPermission = useCallback((action: Permission): boolean => {
    const perms = ROLE_PERMISSIONS[userRole];
    if (!perms) return false;
    return perms.has(action);
  }, [userRole]);

  const checkPlanFeature = useCallback((feature: keyof PlanLimits): boolean => {
    if (!currentPlanLimits) return false;
    const val = currentPlanLimits[feature];
    if (typeof val === "boolean") return val;
    return true;
  }, [currentPlanLimits]);

  return (
    <AuthContext.Provider
      value={{
        user: data?.user ?? null,
        organization: data?.organization ?? null,
        planTier: currentPlanTier,
        planLimits: currentPlanLimits,
        isLoading,
        isAuthenticated: !!data?.user,
        isPlatformUser: isPlatformRole(userRole),
        login,
        register,
        logout,
        hasPermission: checkPermission,
        hasPlanFeature: checkPlanFeature,
        switchOrg,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
