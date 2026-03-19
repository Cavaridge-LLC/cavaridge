// @cavaridge/auth/client — Client-side Supabase auth for React apps
//
// Provides AuthProvider context, useAuth hook, and useSupabase hook.
// Each app passes its own role→permissions map to customize RBAC.

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import { isPlatformRole } from "./index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  /** @deprecated Use `tenantId` */
  organizationId: string | null;
  /** Alias for organizationId — the user's tenant UUID */
  tenantId: string | null;
  isPlatformUser: boolean | null;
  status: string;
}

export interface AuthTenant {
  id: string;
  name: string;
  slug: string;
  type: string;
  parentId: string | null;
  planTier: string | null;
  maxUsers: number | null;
  isActive: boolean | null;
}

/** @deprecated Use `AuthTenant` */
export type AuthOrganization = AuthTenant;

export interface AuthContextType {
  supabase: SupabaseClient;
  session: Session | null;
  profile: AuthProfile | null;
  /** @deprecated Use `tenant` */
  organization: AuthTenant | null;
  /** The current user's tenant */
  tenant: AuthTenant | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPlatformUser: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, organizationName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  hasPermission: (action: string) => boolean;
}

export interface AuthProviderConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  rolePermissions: Record<string, Set<string>>;
  /** Endpoint to fetch profile + org after auth. Default: "/api/auth/me" */
  meEndpoint?: string;
  /** Endpoint to create profile after sign-up. Default: "/api/auth/setup-profile" */
  setupProfileEndpoint?: string;
  /** URL to redirect after OAuth callback. Default: "/" */
  redirectTo?: string;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SupabaseAuthProvider({
  config,
  children,
}: {
  config: AuthProviderConfig;
  children: ReactNode;
}) {
  const supabase = useMemo(
    () => createBrowserClient(config.supabaseUrl, config.supabaseAnonKey),
    [config.supabaseUrl, config.supabaseAnonKey],
  );

  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [organization, setOrganization] = useState<AuthTenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const meEndpoint = config.meEndpoint ?? "/api/auth/me";
  const setupProfileEndpoint = config.setupProfileEndpoint ?? "/api/auth/setup-profile";

  // Fetch profile from our server (validates JWT server-side)
  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(meEndpoint, { credentials: "include" });
      if (!res.ok) {
        setProfile(null);
        setOrganization(null);
        return;
      }
      const data = await res.json();
      const p = data.profile ?? null;
      if (p) p.tenantId = p.organizationId ?? null;
      setProfile(p);
      setOrganization(data.organization ?? null);
    } catch {
      setProfile(null);
      setOrganization(null);
    }
  }, [meEndpoint]);

  // Listen to Supabase auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        fetchProfile().finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession) {
          await fetchProfile();
        } else {
          setProfile(null);
          setOrganization(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  // --- Auth actions ---

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    [supabase],
  );

  const signUp = useCallback(
    async (email: string, password: string, name: string, organizationName?: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name } },
      });
      if (error) throw new Error(error.message);

      // Create profile + organization on our server
      if (data.user) {
        const res = await fetch(setupProfileEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name, organizationName }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || "Failed to set up profile");
        }
        await fetchProfile();
      }
    },
    [supabase, setupProfileEndpoint, fetchProfile],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setOrganization(null);
  }, [supabase]);

  const redirectTo = config.redirectTo
    ? `${window.location.origin}${config.redirectTo}`
    : `${window.location.origin}/api/auth/callback`;

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw new Error(error.message);
  }, [supabase, redirectTo]);

  const signInWithMicrosoft = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo,
        scopes: "openid profile email",
      },
    });
    if (error) throw new Error(error.message);
  }, [supabase, redirectTo]);

  // --- RBAC ---

  const hasPermission = useCallback(
    (action: string): boolean => {
      if (!profile) return false;
      const perms = config.rolePermissions[profile.role];
      return perms ? perms.has(action) : false;
    },
    [profile, config.rolePermissions],
  );

  const value = useMemo<AuthContextType>(
    () => ({
      supabase,
      session,
      profile,
      organization,
      tenant: organization,
      isLoading,
      isAuthenticated: !!profile,
      isPlatformUser: profile ? isPlatformRole(profile.role) : false,
      signIn,
      signUp,
      signOut,
      signInWithGoogle,
      signInWithMicrosoft,
      hasPermission,
    }),
    [
      supabase, session, profile, organization, isLoading,
      signIn, signUp, signOut, signInWithGoogle, signInWithMicrosoft, hasPermission,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within SupabaseAuthProvider");
  return ctx;
}

export function useSupabase(): SupabaseClient {
  const { supabase } = useAuth();
  return supabase;
}
