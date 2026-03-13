import { createContext, useContext, useCallback, useMemo, type ReactNode } from "react";
import { SupabaseAuthProvider, useAuth as useSharedAuth } from "@cavaridge/auth/client";
import { queryClient } from "@/lib/queryClient";

const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  platform_owner: new Set(["*"]),
  platform_admin: new Set(["*"]),
  tenant_admin: new Set(["manage_clients", "manage_users", "use_app"]),
  user: new Set(["use_app", "manage_clients"]),
  viewer: new Set(["use_app"]),
};

const AUTH_CONFIG = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  rolePermissions: ROLE_PERMISSIONS,
  meEndpoint: "/api/auth/me",
};

interface MidasAuthContextType {
  user: { id: string; email: string; displayName: string; role: string; avatarUrl: string | null } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
}

const MidasAuthContext = createContext<MidasAuthContextType | null>(null);

function MidasAuthInner({ children }: { children: ReactNode }) {
  const shared = useSharedAuth();

  const login = useCallback(
    async (email: string, password: string) => {
      await shared.signIn(email, password);
    },
    [shared.signIn],
  );

  const logout = useCallback(async () => {
    await shared.signOut();
    queryClient.clear();
  }, [shared.signOut]);

  const value = useMemo<MidasAuthContextType>(
    () => ({
      user: shared.profile,
      isLoading: shared.isLoading,
      isAuthenticated: shared.isAuthenticated,
      login,
      logout,
      signInWithGoogle: shared.signInWithGoogle,
      signInWithMicrosoft: shared.signInWithMicrosoft,
    }),
    [shared, login, logout],
  );

  return (
    <MidasAuthContext.Provider value={value}>
      {children}
    </MidasAuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SupabaseAuthProvider config={AUTH_CONFIG}>
      <MidasAuthInner>{children}</MidasAuthInner>
    </SupabaseAuthProvider>
  );
}

export function useAuth(): MidasAuthContextType {
  const ctx = useContext(MidasAuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
