import { createContext, useContext, useCallback, useMemo, type ReactNode } from "react";
import { SupabaseAuthProvider, useAuth as useSharedAuth } from "@cavaridge/auth/client";
import { queryClient } from "@/lib/queryClient";

// Astra role → permission map
const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  platform_owner: new Set(["*"]),
  platform_admin: new Set(["*"]),
  tenant_admin: new Set(["manage_reports", "manage_users", "use_app"]),
  user: new Set(["use_app", "manage_reports"]),
  viewer: new Set(["use_app"]),
};

const AUTH_CONFIG = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  rolePermissions: ROLE_PERMISSIONS,
  meEndpoint: "/api/auth/me",
};

interface AstraAuthContextType {
  user: { id: string; email: string; firstName: string; lastName: string; displayName: string; role: string; avatarUrl: string | null; profileImageUrl: string | null } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  isLoggingOut: boolean;
}

const AstraAuthContext = createContext<AstraAuthContextType | null>(null);

function AstraAuthInner({ children }: { children: ReactNode }) {
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

  const user = useMemo(() => {
    if (!shared.profile) return null;
    const parts = (shared.profile.displayName || "").split(" ");
    return {
      ...shared.profile,
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" ") || "",
      profileImageUrl: shared.profile.avatarUrl,
    };
  }, [shared.profile]);

  const value = useMemo<AstraAuthContextType>(
    () => ({
      user,
      isLoading: shared.isLoading,
      isAuthenticated: shared.isAuthenticated,
      login,
      logout,
      signInWithGoogle: shared.signInWithGoogle,
      signInWithMicrosoft: shared.signInWithMicrosoft,
      isLoggingOut: false,
    }),
    [user, shared, login, logout],
  );

  return (
    <AstraAuthContext.Provider value={value}>
      {children}
    </AstraAuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SupabaseAuthProvider config={AUTH_CONFIG}>
      <AstraAuthInner>{children}</AstraAuthInner>
    </SupabaseAuthProvider>
  );
}

export function useAuth(): AstraAuthContextType {
  const ctx = useContext(AstraAuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
