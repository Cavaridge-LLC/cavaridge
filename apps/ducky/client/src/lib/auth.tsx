import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./queryClient";
import type { User, Organization } from "@shared/schema";

export type Permission =
  | "manage_org_settings" | "invite_users" | "change_roles"
  | "ask_questions" | "manage_knowledge" | "view_analytics"
  | "manage_platform" | "manage_all_orgs" | "view_all_orgs"
  | "save_answers" | "view_audit_log";

function pset(...perms: Permission[]): Set<Permission> { return new Set(perms); }

const ALL_ORG_PERMS: Permission[] = [
  "manage_org_settings", "invite_users", "change_roles",
  "ask_questions", "manage_knowledge", "view_analytics",
  "save_answers", "view_audit_log",
];

const ROLE_PERMISSIONS: Record<string, Set<Permission>> = {
  platform_owner: pset(
    ...ALL_ORG_PERMS,
    "manage_platform", "manage_all_orgs", "view_all_orgs",
  ),
  platform_admin: pset(
    ...ALL_ORG_PERMS,
    "view_all_orgs",
  ),
  tenant_admin: pset(
    "manage_org_settings", "invite_users", "change_roles",
    "ask_questions", "manage_knowledge", "view_analytics",
    "save_answers", "view_audit_log",
  ),
  user: pset(
    "ask_questions", "manage_knowledge", "save_answers", "view_analytics",
  ),
  viewer: pset("ask_questions"),
};

export function isPlatformRole(role: string): boolean {
  return role === "platform_owner" || role === "platform_admin";
}

interface AuthContextType {
  user: (Omit<User, "passwordHash">) | null;
  organization: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPlatformUser: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, organizationName?: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (action: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery<{ user: Omit<User, "passwordHash">; organization: Organization } | null>({
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
    mutationFn: async (data: { email: string; password: string; name: string; organizationName?: string }) => {
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

  const register = async (email: string, password: string, name: string, organizationName?: string) => {
    await registerMutation.mutateAsync({ email, password, name, organizationName });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const userRole = data?.user?.role || "";

  const checkPermission = useCallback((action: Permission): boolean => {
    const perms = ROLE_PERMISSIONS[userRole];
    if (!perms) return false;
    return perms.has(action);
  }, [userRole]);

  return (
    <AuthContext.Provider
      value={{
        user: data?.user ?? null,
        organization: data?.organization ?? null,
        isLoading,
        isAuthenticated: !!data?.user,
        isPlatformUser: isPlatformRole(userRole),
        login,
        register,
        logout,
        hasPermission: checkPermission,
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
