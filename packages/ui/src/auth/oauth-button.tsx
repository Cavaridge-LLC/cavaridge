"use client";

import type { AuthProviderEntry } from "@cavaridge/auth/providers";
import { PROVIDER_ICONS } from "./oauth-icons.js";

interface OAuthButtonProps {
  provider: AuthProviderEntry;
  onClick: (providerId: string) => void;
  loading?: boolean;
  mode?: "signin" | "signup";
}

export function OAuthButton({ provider, onClick, loading, mode = "signin" }: OAuthButtonProps) {
  const Icon = PROVIDER_ICONS[provider.icon];
  const label = mode === "signup" ? "Sign up with" : "Sign in with";

  return (
    <button
      type="button"
      onClick={() => onClick(provider.id)}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 py-2.5 bg-[var(--bg-card)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50 transition-colors"
    >
      {Icon && <Icon className="w-4 h-4" />}
      {loading ? "Redirecting..." : `${label} ${provider.name}`}
    </button>
  );
}
