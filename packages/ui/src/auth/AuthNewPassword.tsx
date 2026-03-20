"use client";

import { useState, type ReactNode, type FormEvent } from "react";
import { PasswordStrength, isPasswordStrong } from "./password-strength.js";
import { Lock, KeyRound, Check } from "lucide-react";

export interface AuthNewPasswordProps {
  /** Called when user submits new password */
  onUpdatePassword: (newPassword: string) => Promise<void>;
  /** URL for "Back to Sign in" link (shown after success) */
  signInUrl?: string;
  /** Optional app branding */
  appName?: string;
  appIcon?: ReactNode;
  /** Called when "Back to Sign in" is clicked (overrides signInUrl) */
  onBackToSignIn?: () => void;
}

export function AuthNewPassword({
  onUpdatePassword,
  signInUrl = "/login",
  appName,
  appIcon,
  onBackToSignIn,
}: AuthNewPasswordProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
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
      await onUpdatePassword(password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const signInLink = onBackToSignIn ? (
    <button
      onClick={onBackToSignIn}
      className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors"
    >
      Continue to Sign in
    </button>
  ) : (
    <a
      href={signInUrl}
      className="block w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors text-center"
    >
      Continue to Sign in
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
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 text-green-500" />
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Password Updated
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Your password has been successfully updated. You can now sign in with your new password.
              </p>
              {signInLink}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <KeyRound className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Set New Password
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="text-xs text-[var(--text-secondary)] block mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-disabled)]" />
                    <input
                      id="new-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-panel)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      placeholder="Create a new password"
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
                  <label htmlFor="confirm-new-password" className="text-xs text-[var(--text-secondary)] block mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-disabled)]" />
                    <input
                      id="confirm-new-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-panel)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      placeholder="Confirm your new password"
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
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </form>
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
