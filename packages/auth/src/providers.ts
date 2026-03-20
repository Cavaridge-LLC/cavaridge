// @cavaridge/auth/providers — Centralized auth provider configuration
//
// Defines which auth providers are available across the platform.
// UI components read this array to dynamically render OAuth buttons.
// Adding a new provider (e.g., Apple) requires only:
//   1. Add entry here with enabled: true
//   2. Add one button icon in packages/ui/
//   3. Enable provider in Supabase dashboard

export interface AuthProviderEntry {
  /** Supabase provider ID (e.g., 'azure', 'google', 'apple') */
  id: string;
  /** Display name (e.g., 'Microsoft', 'Google') */
  name: string;
  /** Icon key — maps to icon component in packages/ui/ */
  icon: string;
  /** Whether this provider is currently enabled */
  enabled: boolean;
  /** OAuth scopes to request */
  scopes?: string;
}

/**
 * All registered auth providers. UI components render buttons
 * only for entries with `enabled: true`.
 */
export const AUTH_PROVIDERS: readonly AuthProviderEntry[] = [
  {
    id: "azure",
    name: "Microsoft",
    icon: "microsoft",
    enabled: true,
    scopes: "openid profile email User.Read",
  },
  {
    id: "google",
    name: "Google",
    icon: "google",
    enabled: true,
    scopes: "email profile openid",
  },
  {
    id: "apple",
    name: "Apple",
    icon: "apple",
    enabled: false, // Future — flip to true when Apple ID provider is configured in Supabase
  },
] as const;

/**
 * Only providers that are currently enabled.
 * UI components should use this to render OAuth buttons.
 */
export const SUPPORTED_PROVIDERS: readonly AuthProviderEntry[] =
  AUTH_PROVIDERS.filter((p) => p.enabled);

/** Look up a provider by Supabase ID */
export function getProvider(id: string): AuthProviderEntry | undefined {
  return AUTH_PROVIDERS.find((p) => p.id === id);
}
