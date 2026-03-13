import { createContext, useContext, type ReactNode } from "react";
import { SupabaseAuthProvider, useAuth as useSharedAuth, type AuthConfig } from "@cavaridge/auth/client";

const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  platform_owner: new Set(["*"]),
  platform_admin: new Set(["*"]),
  tenant_admin: new Set(["manage_plans", "manage_users", "use_app"]),
  user: new Set(["use_app", "manage_plans"]),
  viewer: new Set(["use_app"]),
};

const AUTH_CONFIG: AuthConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  rolePermissions: ROLE_PERMISSIONS,
  meEndpoint: "/api/auth/me",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  return SupabaseAuthProvider({ config: AUTH_CONFIG, children });
}

export function useAuth() {
  return useSharedAuth();
}

export { useSharedAuth as useUser };
