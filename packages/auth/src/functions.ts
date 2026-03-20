// @cavaridge/auth/functions — Standalone auth functions
//
// Each function takes a SupabaseClient as its first parameter.
// These are the building blocks used by the SupabaseAuthProvider context.
// Apps can also call them directly for non-React code, tests, or custom flows.
//
// Usage:
//   import { signInWithEmail, signInWithGoogle } from "@cavaridge/auth/functions";
//   const { data, error } = await signInWithEmail(supabase, email, password);

import type { SupabaseClient, AuthResponse, AuthOtpResponse } from "@supabase/supabase-js";
import { getProvider } from "./providers.js";

// ---------------------------------------------------------------------------
// Email + Password
// ---------------------------------------------------------------------------

/**
 * Register a new user with email and password.
 * Sends a confirmation email by default (Supabase handles this).
 *
 * @param metadata - Optional user metadata (full_name, company, etc.)
 *   passed through to supabase.auth.signUp({ options: { data: metadata } })
 */
export async function signUpWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string,
  metadata?: Record<string, unknown>,
): Promise<AuthResponse> {
  return supabase.auth.signUp({
    email,
    password,
    options: metadata ? { data: metadata } : undefined,
  });
}

/**
 * Sign in an existing user with email and password.
 */
export async function signInWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string,
): Promise<AuthResponse> {
  return supabase.auth.signInWithPassword({ email, password });
}

/**
 * Send a password reset email.
 *
 * @param redirectTo - URL the user lands on after clicking the reset link.
 *   Should point to the app's /reset-password page.
 */
export async function resetPassword(
  supabase: SupabaseClient,
  email: string,
  redirectTo?: string,
) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
}

/**
 * Update the current user's password.
 * Requires an active session (user must be signed in via reset link).
 */
export async function updatePassword(
  supabase: SupabaseClient,
  newPassword: string,
) {
  return supabase.auth.updateUser({ password: newPassword });
}

// ---------------------------------------------------------------------------
// OAuth Providers
// ---------------------------------------------------------------------------

/**
 * Generic OAuth sign-in. Reads scopes from the provider config registry.
 */
export async function signInWithProvider(
  supabase: SupabaseClient,
  providerId: string,
  redirectTo?: string,
) {
  const provider = getProvider(providerId);
  const scopes = provider?.scopes;

  return supabase.auth.signInWithOAuth({
    provider: providerId as any,
    options: {
      redirectTo,
      ...(scopes ? { scopes } : {}),
    },
  });
}

/**
 * Sign in with Microsoft (Azure AD / Entra ID).
 * Scopes: openid profile email User.Read
 */
export async function signInWithMicrosoft(
  supabase: SupabaseClient,
  redirectTo?: string,
) {
  return supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      redirectTo,
      scopes: "openid profile email User.Read",
    },
  });
}

/**
 * Sign in with Google.
 * Scopes: email profile openid
 */
export async function signInWithGoogle(
  supabase: SupabaseClient,
  redirectTo?: string,
) {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: "email profile openid",
    },
  });
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/** Sign out the current user. */
export async function signOut(supabase: SupabaseClient) {
  return supabase.auth.signOut();
}

/** Get the current session (if any). */
export async function getSession(supabase: SupabaseClient) {
  return supabase.auth.getSession();
}

/** Listen for auth state changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.). */
export function onAuthStateChange(
  supabase: SupabaseClient,
  callback: Parameters<SupabaseClient["auth"]["onAuthStateChange"]>[0],
) {
  return supabase.auth.onAuthStateChange(callback);
}

// ---------------------------------------------------------------------------
// Future — stubs (DO NOT implement yet)
// ---------------------------------------------------------------------------

// TODO: signInWithApple(supabase, redirectTo?) — Apple ID, next provider
// TODO: enrollMfa(supabase, factorType: 'totp') — MFA via authenticator app
// TODO: verifyMfa(supabase, factorId, code) — MFA verification
// TODO: enrollPasskey(supabase) — WebAuthn passkey enrollment
// TODO: verifyPasskey(supabase) — WebAuthn passkey verification
