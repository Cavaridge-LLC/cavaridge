"use client";

import { useState, type ReactNode, type FormEvent } from "react";
import type { AuthProviderEntry } from "@cavaridge/auth/providers";
import { OAuthButton } from "./oauth-button.js";
import { Lock, Mail, ArrowRight } from "lucide-react";

export interface AuthLoginProps {
  /** Called when user submits email + password */
  onSignIn: (email: string, password: string) => Promise<void>;
  /** Called when user clicks an OAuth button */
  onSignInWithProvider: (providerId: string) => void;
  /** Enabled OAuth providers to render buttons for */
  providers: readonly AuthProviderEntry[];
  /** URL for "Don't have an account? Sign up" link */
  signUpUrl?: string;
  /** URL for "Forgot password?" link */
  forgotPasswordUrl?: string;
  /** Optional app branding */
  appName?: string;
  appIcon?: ReactNode;
  appTagline?: string;
  /** Called when "Forgot password?" is clicked (overrides forgotPasswordUrl) */
  onForgotPassword?: () => void;
  /** Called when "Sign up" link is clicked (overrides signUpUrl) */
  onSignUpClick?: () => void;
}

export function AuthLogin({
  onSignIn,
  onSignInWithProvider,
  providers,
  signUpUrl = "/register",
  forgotPasswordUrl = "/forgot-password",
  appName,
  appIcon,
  appTagline,
  onForgotPassword,
  onSignUpClick,
}: AuthLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSignIn(email, password);
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = (providerId: string) => {
    setError("");
    setOauthLoading(providerId);
    try {
      onSignInWithProvider(providerId);
    } catch (err: any) {
      setError(err.message || "OAuth sign-in failed");
      setOauthLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4">
      <div className="w-full max-w-sm">
        {/* App branding */}
        {(appName || appIcon) && (
          <div className="text-center mb-8">
            {appIcon && <div className="flex items-center justify-center mb-2">{appIcon}</div>}
            {appName && (
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                {appName}
              </h1>
            )}
            {appTagline && (
              <p className="text-sm text-[var(--text-secondary)] mt-1">{appTagline}</p>
            )}
          </div>
        )}

        <div
          className="p-6 rounded-xl border border-[var(--theme-border)]"
          style={{ background: "var(--bg-card)" }}
        >
          {/* OAuth buttons */}
          {providers.length > 0 && (
            <>
              <div className="space-y-2 mb-4">
                {providers.map((provider) => (
                  <OAuthButton
                    key={provider.id}
                    provider={provider}
                    onClick={handleOAuth}
                    loading={oauthLoading === provider.id}
                    mode="signin"
                  />
                ))}
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-[var(--theme-border)]" />
                <span className="text-xs text-[var(--text-disabled)]">or</span>
                <div className="flex-1 h-px bg-[var(--theme-border)]" />
              </div>
            </>
          )}

          {/* Email + password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="text-xs text-[var(--text-secondary)] block mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-disabled)]" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-panel)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="text-xs text-[var(--text-secondary)] block mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-disabled)]" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-panel)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Forgot password */}
            <div className="text-right">
              {onForgotPassword ? (
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-xs text-[var(--text-disabled)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  Forgot your password?
                </button>
              ) : (
                <a
                  href={forgotPasswordUrl}
                  className="text-xs text-[var(--text-disabled)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  Forgot your password?
                </a>
              )}
            </div>

            {error && <p className="text-xs text-red-400 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Sign up link */}
        <div className="text-center mt-4">
          {onSignUpClick ? (
            <button
              onClick={onSignUpClick}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Don't have an account? <span className="font-medium">Sign up</span>
            </button>
          ) : (
            <a
              href={signUpUrl}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Don't have an account? <span className="font-medium">Sign up</span>
            </a>
          )}
        </div>

        <p className="text-center text-[10px] text-[var(--text-disabled)] mt-8">
          Cavaridge, LLC
        </p>
      </div>
    </div>
  );
}
