/** Mascot asset configuration. */
export interface MascotConfig {
  /** Inline SVG string for the mascot (used by DuckyMascotImage component). */
  svgContent: string;
  /** Alt text for accessibility. */
  alt: string;
}

/** Favicon configuration for an app. */
export interface FaviconConfig {
  /** Default favicon SVG string. */
  default: string;
  /** Tool-specific favicon overrides keyed by route slug. */
  tools: Record<string, string>;
}

/** Color palette for a brand. */
export interface BrandColors {
  primary: string;
  accent: string;
  [key: string]: string;
}

/** Logo configuration. */
export interface LogoConfig {
  /** SVG string or image URL. */
  src: string;
  alt: string;
}

/**
 * Tenant branding configuration.
 *
 * Every Cavaridge app reads from this config for mascot, favicon, colors,
 * and logo. A future tenant can supply their own config to re-brand
 * whichever apps they use.
 */
export interface TenantBranding {
  tenantId: string;
  name: string;
  mascot: MascotConfig;
  favicon: FaviconConfig;
  colors: BrandColors;
  logo?: LogoConfig;
  footer: {
    tagline: string;
    copyright: string;
  };
}

/** Per-app branding overrides. Apps extend the base tenant config. */
export interface AppBranding extends Partial<TenantBranding> {
  appName: string;
  appDescription: string;
  favicon: FaviconConfig;
}
