"use client";

import { useState, type ReactNode, type FormEvent } from "react";
import { Mail, ArrowLeft, KeyRound } from "lucide-react";

export interface AuthResetPasswordProps {
  /** Called when user submits email for password reset */
  onResetPassword: (email: string) => Promise<void>;
  /** URL for "Back to Sign in" link */
  signInUrl?: string;
  /** Optional app branding */
  appName?: string;
  appIcon?: ReactNode;
  /** Called when "Back to Sign in" is clicked (overrides signInUrl) */
  onBackToSignIn?: () => void;
}

export function AuthResetPassword({
  onResetPassword,
  signInUrl = "/login",
  appName,
  appIcon,
  onBackToSignIn,
}: AuthResetPasswordProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onResetPassword(email);
      setSent(true);
    } catch {
      // Always show success message to prevent email enumeration
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  const backLink = onBackToSignIn ? (
    <button
      onClick={onBackToSignIn}
      className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
    >
      <ArrowLeft className="w-3 h-3" />
      Back to Sign in
    </button>
  ) : (
    <a
      href={signInUrl}
      className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
    >
      <ArrowLeft className="w-3 h-3" />
      Back to Sign in
    </a>
  );

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
          </div>
        )}

        <div
          className="p-6 rounded-xl border border-[var(--theme-border)]"
          style={{ background: "var(--bg-card)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Reset Password
            </h2>
          </div>

          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">
                If an account exists for <strong>{email}</strong>, you'll receive a
                password reset link shortly.
              </p>
              <div className="text-center">{backLink}</div>
            </div>
          ) : (
            <>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="reset-email" className="text-xs text-[var(--text-secondary)] block mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-disabled)]" />
                    <input
                      id="reset-email"
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

                {error && <p className="text-xs text-red-400 text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>

              <div className="text-center mt-4">{backLink}</div>
            </>
          )}
        </div>

        <p className="text-center text-[10px] text-[var(--text-disabled)] mt-8">
          Cavaridge, LLC
        </p>
      </div>
    </div>
  );
}
