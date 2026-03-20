"use client";

import { useState, type ReactNode, type FormEvent } from "react";
import type { AuthProviderEntry } from "@cavaridge/auth/providers";
import { OAuthButton } from "./oauth-button.js";
import { PasswordStrength, isPasswordStrong } from "./password-strength.js";
import { Lock, Mail, ArrowRight, User } from "lucide-react";

export interface AuthRegisterProps {
  /** Called when user submits registration form */
  onRegister: (email: string, password: string, name: string) => Promise<void>;
  /** Called when user clicks an OAuth button */
  onSignInWithProvider: (providerId: string) => void;
  /** Enabled OAuth providers to render buttons for */
  providers: readonly AuthProviderEntry[];
  /** URL for "Already have an account? Sign in" link */
  signInUrl?: string;
  /** Optional app branding */
  appName?: string;
  appIcon?: ReactNode;
  appTagline?: string;
  /** Called when "Sign in" link is clicked (overrides signInUrl) */
  onSignInClick?: () => void;
}

export function AuthRegister({
  onRegister,
  onSignInWithProvider,
  providers,
  signInUrl = "/login",
  appName,
  appIcon,
  appTagline,
  onSignInClick,
}: AuthRegisterProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!isPasswordStrong(password)) {
      setError("Password does not meet strength requirements");
      return;
    }

    setLoading(true);
    try {
      await onRegister(email, password, name);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Registration failed");
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
      setError(err.message || "OAuth sign-up failed");
      setOauthLoading(null);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4">
        <div className="w-full max-w-sm">
          <div
            className="p-6 rounded-xl border border-[var(--theme-border)] text-center"
            style={{ background: "var(--bg-card)" }}
          >
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-green-500" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              Check your email
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              We've sent a confirmation link to <strong>{email}</strong>.
              Please check your email to verify your account.
            </p>
          </div>
          <div className="text-center mt-4">
            {onSignInClick ? (
              <button
                onClick={onSignInClick}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Back to <span className="font-medium">Sign in</span>
              </button>
            ) : (
              <a
                href={signInUrl}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Back to <span className="font-medium">Sign in</span>
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

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
                    mode="signup"
                  />
                ))}
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-[var(--theme-border)]" />
                <span className="text-xs text-[var(--text-disabled)]">or sign up with email</span>
                <div className="flex-1 h-px bg-[var(--theme-border)]" />
              </div>
            </>
          )}

          {/* Registration form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="register-name" className="text-xs text-[var(--text-secondary)] block mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-disabled)]" />
                <input
                  id="register-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-panel)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Your full name"
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="register-email" className="text-xs text-[var(--text-secondary)] block mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-disabled)]" />
                <input
                  id="register-email"
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
              <label htmlFor="register-password" className="text-xs text-[var(--text-secondary)] block mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-disabled)]" />
                <input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-panel)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Create a password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="mt-2">
                <PasswordStrength password={password} />
              </div>
            </div>

            <div>
              <label htmlFor="register-confirm" className="text-xs text-[var(--text-secondary)] block mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-disabled)]" />
                <input
                  id="register-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-panel)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Confirm your password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-[11px] text-red-400 mt-1">Passwords do not match</p>
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
                  Create Account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Sign in link */}
        <div className="text-center mt-4">
          {onSignInClick ? (
            <button
              onClick={onSignInClick}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Already have an account? <span className="font-medium">Sign in</span>
            </button>
          ) : (
            <a
              href={signInUrl}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Already have an account? <span className="font-medium">Sign in</span>
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
