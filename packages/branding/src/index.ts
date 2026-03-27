// Types
export type {
  TenantBranding,
  AppBranding,
  MascotConfig,
  FaviconConfig,
  BrandColors,
  LogoConfig,
} from "./types";

// Config
export {
  DEFAULT_BRANDING,
  CERES_BRANDING,
  CAELUM_BRANDING,
  HIPAA_BRANDING,
  FORGE_BRANDING,
  AEGIS_BRANDING,
  MERIDIAN_BRANDING,
  MIDAS_BRANDING,
  resolveBranding,
} from "./config";

// Components
export { DuckyMascotImage } from "./components/DuckyMascotImage";
export type { DuckyMascotImageSize } from "./components/DuckyMascotImage";

// Hooks
export { useDynamicFavicon } from "./hooks/useDynamicFavicon";

// Assets (for apps that need raw SVG strings)
export {
  DUCKY_MASCOT_SVG_LIGHT,
  DUCKY_MASCOT_SVG_DARK,
  DUCKY_FAVICON_SVG,
} from "./assets/ducky-mascot";
export {
  CERES_FREQUENCY_FAVICON,
  CERES_UTILIZATION_FAVICON,
  CERES_OASIS_FAVICON,
  CERES_DISCIPLINE_FAVICON,
  CERES_COMPLIANCE_FAVICON,
} from "./assets/favicons";
