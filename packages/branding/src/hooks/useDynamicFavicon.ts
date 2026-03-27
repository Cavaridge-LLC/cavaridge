import { useEffect, useRef } from "react";
import type { FaviconConfig } from "../types";

/** Convert an SVG string to a data URI suitable for a favicon link. */
function svgToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Dynamically swap the document favicon based on the current tool/page.
 *
 * @param faviconConfig - The app's favicon config from TenantBranding.
 * @param toolSlug - Current tool/page slug (e.g., "frequency-calculator").
 *   Pass `undefined` or empty string for the default favicon.
 *
 * @example
 * ```tsx
 * import { useDynamicFavicon, CERES_BRANDING } from "@cavaridge/branding";
 *
 * function App() {
 *   const toolSlug = useCurrentToolSlug(); // derive from router
 *   useDynamicFavicon(CERES_BRANDING.favicon, toolSlug);
 *   return <Router />;
 * }
 * ```
 */
export function useDynamicFavicon(
  faviconConfig: FaviconConfig,
  toolSlug?: string,
): void {
  const currentHref = useRef<string>("");

  useEffect(() => {
    const svg = (toolSlug && faviconConfig.tools[toolSlug]) || faviconConfig.default;
    const href = svgToDataUri(svg);

    // Skip if the favicon hasn't changed.
    if (href === currentHref.current) return;
    currentHref.current = href;

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/svg+xml";
    link.href = href;
  }, [faviconConfig, toolSlug]);
}
