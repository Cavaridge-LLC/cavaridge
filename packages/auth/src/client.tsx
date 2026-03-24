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
import {
  signInWithEmail as _signInWithEmail,
  signUpWithEmail as _signUpWithEmail,
  signInWithGoogle as _signInWithGoogle,
  signInWithMicrosoft as _signInWithMicrosoft,
  signInWithProvider as _signInWithProvider,
  resetPassword as _resetPassword,
  updatePassword as _updatePassword,
  signOut as _signOut,
} from "./functions.js";
import { SUPPORTED_PROVIDERS, type AuthProviderEntry } from "./providers.js";

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
  /** Enabled OAuth providers for rendering buttons */
  supportedProviders: readonly AuthProviderEntry[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, organizationName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signInWithProvider: (providerId: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
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
  /** URL to redirect after OAuth callback. Default: "/auth/callback" */
  redirectTo?: string;
}

/**
 * Props shape returned by useAuthProps() for wiring to shared UI auth components.
 * Designed to match the props of AuthLogin, AuthRegister, etc. in packages/ui/.
 */
export interface AuthComponentProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, name: string) => Promise<void>;
  onSignInWithProvider: (providerId: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onUpdatePassword: (newPassword: string) => Promise<void>;
  providers: readonly AuthProviderEntry[];
  isAuthenticated: boolean;
  isLoading: boolean;
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

  // Helper: build fetch headers with Bearer token from current session.
  // Cookies may not be available (Railway proxy / domain issues), so we
  // always send the JWT explicitly via Authorization header.
  const authHeaders = useCallback(
    async (extra?: Record<string, string>): Promise<Record<string, string>> => {
      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token;
      return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(extra ?? {}),
      };
    },
    [supabase],
  );

  // Fetch profile from our server (validates JWT server-side).
  // If the profile doesn't exist yet (401), auto-create it via setup-profile.
  // This handles users who authenticated (email or OAuth) but don't have a
  // profile row in the database yet.
  const fetchProfile = useCallback(async () => {
    try {
      const headers = await authHeaders();
      let res = await fetch(meEndpoint, {
        credentials: "include",
        headers,
      });

      if (res.status === 401) {
        // Profile may not exist yet — try to create it
        const setupHeaders = await authHeaders({ "Content-Type": "application/json" });
        const setupRes = await fetch(setupProfileEndpoint, {
          method: "POST",
          headers: setupHeaders,
          credentials: "include",
          body: JSON.stringify({}),
        });

        if (setupRes.ok) {
          // Retry /me now that the profile exists
          res = await fetch(meEndpoint, {
            credentials: "include",
            headers,
          });
        }
      }

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
  }, [meEndpoint, setupProfileEndpoint, authHeaders]);

  // Listen to Supabase auth state changes
  useEffect(() => {
    // Safety timeout: if getSession() hangs (stale cookies, network issues),
    // ensure we still render the app instead of showing a spinner forever.
    const safetyTimer = setTimeout(() => {
      setIsLoading((current) => {
        if (current) {
          console.warn("Auth initialization timed out after 8s — clearing session");
          setSession(null);
          setProfile(null);
          setOrganization(null);
          // Clear potentially corrupted Supabase cookies
          document.cookie.split(";").forEach((c) => {
            const name = c.trim().split("=")[0];
            if (name.startsWith("sb-")) {
              document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            }
          });
        }
        return false;
      });
    }, 8000);

    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        if (s) {
          fetchProfile().finally(() => setIsLoading(false));
        } else {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("getSession() failed:", err);
        setSession(null);
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        await fetchProfile();
      } else {
        setProfile(null);
        setOrganization(null);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  // --- Auth actions (using standalone functions from functions.ts) ---

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await _signInWithEmail(supabase, email, password);
      if (error) throw new Error(error.message);
    },
    [supabase],
  );

  const signUp = useCallback(
    async (email: string, password: string, name: string, organizationName?: string) => {
      const { data, error } = await _signUpWithEmail(supabase, email, password, {
        display_name: name,
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

  const handleSignOut = useCallback(async () => {
    await _signOut(supabase);
    setProfile(null);
    setOrganization(null);
  }, [supabase]);

  const redirectTo = config.redirectTo
    ? `${window.location.origin}${config.redirectTo}`
    : `${window.location.origin}/auth/callback`;

  const signInWithGoogle = useCallback(async () => {
    const { error } = await _signInWithGoogle(supabase, redirectTo);
    if (error) throw new Error(error.message);
  }, [supabase, redirectTo]);

  const signInWithMicrosoft = useCallback(async () => {
    const { error } = await _signInWithMicrosoft(supabase, redirectTo);
    if (error) throw new Error(error.message);
  }, [supabase, redirectTo]);

  const signInWithProvider = useCallback(async (providerId: string) => {
    if (providerId === "google") return signInWithGoogle();
    if (providerId === "azure") return signInWithMicrosoft();
    // Generic fallback for future providers
    const { error } = await _signInWithProvider(supabase, providerId, redirectTo);
    if (error) throw new Error(error.message);
  }, [supabase, redirectTo, signInWithGoogle, signInWithMicrosoft]);

  const resetPasswordFn = useCallback(async (email: string) => {
    const resetRedirect = `${window.location.origin}/reset-password`;
    const { error } = await _resetPassword(supabase, email, resetRedirect);
    if (error) throw new Error(error.message);
  }, [supabase]);

  const updatePasswordFn = useCallback(async (newPassword: string) => {
    const { error } = await _updatePassword(supabase, newPassword);
    if (error) throw new Error(error.message);
  }, [supabase]);

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
      supportedProviders: SUPPORTED_PROVIDERS,
      signIn,
      signUp,
      signOut: handleSignOut,
      signInWithGoogle,
      signInWithMicrosoft,
      signInWithProvider,
      resetPassword: resetPasswordFn,
      updatePassword: updatePasswordFn,
      hasPermission,
    }),
    [
      supabase, session, profile, organization, isLoading,
      signIn, signUp, handleSignOut, signInWithGoogle, signInWithMicrosoft,
      signInWithProvider, resetPasswordFn, updatePasswordFn, hasPermission,
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

/**
 * Returns props shaped for the shared auth UI components (AuthLogin, AuthRegister, etc.).
 * Use this in app page wrappers to wire auth context to UI components:
 *
 *   const authProps = useAuthProps();
 *   return <AuthLogin {...authProps} appName="Meridian" />;
 */
export function useAuthProps(): AuthComponentProps {
  const auth = useAuth();
  return useMemo(() => ({
    onSignIn: auth.signIn,
    onRegister: auth.signUp,
    onSignInWithProvider: auth.signInWithProvider,
    onResetPassword: auth.resetPassword,
    onUpdatePassword: auth.updatePassword,
    providers: auth.supportedProviders,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
  }), [auth]);
}

// ---------------------------------------------------------------------------
// AuthCallback — client-side OAuth callback handler
// ---------------------------------------------------------------------------

/**
 * Drop this component into a /auth/callback route.
 * It reads the auth code from the URL, exchanges it for a session using the
 * browser's Supabase client (which has access to the PKCE code_verifier),
 * then redirects to the app root.
 *
 * Usage in App.tsx:
 *   <Route path="/auth/callback" component={AuthCallback} />
 */
export function AuthCallback() {
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);
  const [profileEnsured, setProfileEnsured] = useState(false);

  // Step 1: Actively exchange the ?code= for a session.
  // We cannot rely on createBrowserClient's detectSessionInUrl because
  // the SupabaseAuthProvider may have already called getSession() before
  // this component mounts (the isLoading check used to block rendering).
  // Explicitly exchanging the code is the reliable path.
  useEffect(() => {
    if (exchanging || auth.session) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      setError("No authorization code found in URL");
      return;
    }

    setExchanging(true);

    auth.supabase.auth.exchangeCodeForSession(code).then(({ data, error: err }) => {
      if (err) {
        console.error("PKCE exchange error:", err);
        setError(err.message || "Failed to complete sign in");
        return;
      }
      // Clean the code from the URL so it can't be replayed
      window.history.replaceState(null, "", window.location.pathname);
      // Session will be picked up by onAuthStateChange in the parent provider
    }).catch((err: any) => {
      console.error("PKCE exchange exception:", err);
      setError(err.message || "Failed to complete sign in");
    });
  }, [auth.supabase, auth.session, exchanging]);

  // Step 2: Once session is established, ensure profile exists
  useEffect(() => {
    if (!auth.session || profileEnsured) return;

    let cancelled = false;

    async function ensureProfile() {
      try {
        const token = auth.session?.access_token;
        const res = await fetch("/api/auth/setup-profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify({}),
        });
        if (!cancelled) {
          setProfileEnsured(true);
          // Redirect to app root after profile is ensured
          window.location.replace("/");
        }
      } catch (err: any) {
        console.error("Profile setup error:", err);
        if (!cancelled) setError(err.message || "Failed to set up profile");
      }
    }

    ensureProfile();
    return () => { cancelled = true; };
  }, [auth.session, profileEnsured]);

  // Fallback: if nothing happens after 10s, redirect to login
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!profileEnsured) {
        console.warn("OAuth callback timeout — redirecting to login");
        window.location.replace("/login");
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [profileEnsured]);

  if (error) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Authentication Error</h2>
        <p style={{ color: "#ef4444" }}>{error}</p>
        <p style={{ marginTop: "1rem" }}>
          <a href="/login" style={{ color: "#3b82f6" }}>Back to login</a>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <p>{profileEnsured ? "Redirecting..." : "Completing sign in..."}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuthRecoveryHandler — handles ?code= on the reset-password page
// ---------------------------------------------------------------------------

/**
 * Drop this component into the reset-password page to handle Supabase's
 * PKCE recovery flow. It exchanges the ?code= parameter for a session
 * (PASSWORD_RECOVERY event), then renders children (the password form).
 *
 * Usage:
 *   <AuthRecoveryHandler>
 *     <AuthNewPassword onUpdatePassword={updatePassword} />
 *   </AuthRecoveryHandler>
 */
export function AuthRecoveryHandler({ children }: { children: ReactNode }) {
  const { supabase } = useAuth();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function handleRecovery() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (!code) {
        // No code — user navigated here directly (maybe already has session)
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          if (!cancelled) setReady(true);
        } else {
          if (!cancelled) setError("No recovery code found. Please request a new password reset.");
        }
        return;
      }

      try {
        const { error: err } = await supabase.auth.exchangeCodeForSession(code);
        if (err) throw err;

        // Clean the code from the URL so it's not reused
        window.history.replaceState(null, "", window.location.pathname);

        if (!cancelled) setReady(true);
      } catch (err: any) {
        console.error("Recovery code exchange error:", err);
        if (!cancelled) setError(err.message || "Failed to verify recovery code");
      }
    }

    handleRecovery();
    return () => { cancelled = true; };
  }, [supabase]);

  if (error) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Recovery Error</h2>
        <p style={{ color: "#ef4444", marginBottom: "1rem" }}>{error}</p>
        <a href="/forgot-password" style={{ color: "#3b82f6" }}>Request new reset link</a>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Verifying recovery link...</p>
      </div>
    );
  }

  return <>{children}</>;
}
