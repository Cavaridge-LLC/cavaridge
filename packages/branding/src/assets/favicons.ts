/**
 * Tool favicon SVG generators.
 *
 * Each favicon is a 32×32 SVG with a Lucide-style icon (white)
 * on a rounded-rect background in the tool's primary color.
 */

/** Generate a tool favicon SVG: white icon on colored rounded-rect. */
function toolFavicon(bgColor: string, iconPath: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="${bgColor}"/>
  <g transform="translate(6,6)" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    ${iconPath}
  </g>
</svg>`;
}

// ── Ceres tool favicons ──────────────────────────────────────────────

/** 60-Day Frequency Calculator — Activity/heartbeat icon. */
export const CERES_FREQUENCY_FAVICON = toolFavicon(
  "#2563EB",
  `<polyline points="20 12 16 12 13 19 7 1 4 12 0 12"/>`
);

/** Over-Utilization Calculator — BarChart3 icon. */
export const CERES_UTILIZATION_FAVICON = toolFavicon(
  "#7C3AED",
  `<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20V14"/>`
);

/** OASIS Timing Assistant — Clock icon. */
export const CERES_OASIS_FAVICON = toolFavicon(
  "#E07A3A",
  `<circle cx="10" cy="10" r="9"/><polyline points="10 4 10 10 14 12"/>`
);

/** Discipline Coordination Planner — Users icon. */
export const CERES_DISCIPLINE_FAVICON = toolFavicon(
  "#059669",
  `<path d="M14 19a6 6 0 0 0-12 0"/><circle cx="8" cy="7" r="4"/><path d="M20 19a6 6 0 0 0-6-6"/><circle cx="16" cy="5" r="3"/>`
);

/** Compliance Checklist Builder — ClipboardList icon. */
export const CERES_COMPLIANCE_FAVICON = toolFavicon(
  "#DC2626",
  `<rect x="2" y="2" width="16" height="18" rx="2"/><path d="M6 1v3"/><path d="M14 1v3"/><path d="M6 11h4"/><path d="M6 15h8"/><path d="M6 7h8"/>`
);
