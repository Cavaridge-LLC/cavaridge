/**
 * Standalone Ducky mascot SVG — Blenheim Cavalier King Charles Spaniel.
 *
 * Extracted from @cavaridge/ducky-animations DuckyAnimation.tsx for use
 * as a static image asset. This SVG uses the light-theme Blenheim colors;
 * dark-theme variants are handled at the component level.
 */

/** Light-theme Ducky SVG (64×64 viewBox). */
export const DUCKY_MASCOT_SVG_LIGHT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <ellipse cx="32" cy="38" rx="18" ry="16" fill="#F5A623"/>
  <circle cx="32" cy="20" r="14" fill="#F5A623"/>
  <ellipse cx="19" cy="16" rx="6" ry="10" fill="#C47A1A" transform="rotate(-15 19 16)"/>
  <ellipse cx="45" cy="16" rx="6" ry="10" fill="#C47A1A" transform="rotate(15 45 16)"/>
  <ellipse cx="32" cy="18" rx="5" ry="7" fill="#FFFFFF" opacity="0.85"/>
  <circle cx="27" cy="19" r="2.5" fill="#2D1B0E"/>
  <circle cx="27.8" cy="18.2" r="0.8" fill="#FFFFFF"/>
  <circle cx="37" cy="19" r="2.5" fill="#2D1B0E"/>
  <circle cx="37.8" cy="18.2" r="0.8" fill="#FFFFFF"/>
  <ellipse cx="32" cy="24" rx="2" ry="1.5" fill="#2D1B0E"/>
  <path d="M30 25.5 Q32 27.5 34 25.5" stroke="#2D1B0E" stroke-width="0.8" fill="none" stroke-linecap="round"/>
  <ellipse cx="32" cy="34" rx="8" ry="6" fill="#FFFFFF" opacity="0.7"/>
  <ellipse cx="24" cy="50" rx="4" ry="3" fill="#F5A623"/>
  <ellipse cx="40" cy="50" rx="4" ry="3" fill="#F5A623"/>
  <ellipse cx="49" cy="36" rx="3" ry="2" fill="#C47A1A" transform="rotate(-30 49 36)"/>
</svg>`;

/** Dark-theme Ducky SVG (64×64 viewBox). */
export const DUCKY_MASCOT_SVG_DARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <ellipse cx="32" cy="38" rx="18" ry="16" fill="#E89B1D"/>
  <circle cx="32" cy="20" r="14" fill="#E89B1D"/>
  <ellipse cx="19" cy="16" rx="6" ry="10" fill="#B06E15" transform="rotate(-15 19 16)"/>
  <ellipse cx="45" cy="16" rx="6" ry="10" fill="#B06E15" transform="rotate(15 45 16)"/>
  <ellipse cx="32" cy="18" rx="5" ry="7" fill="#F0F0F0" opacity="0.85"/>
  <circle cx="27" cy="19" r="2.5" fill="#1A1008"/>
  <circle cx="27.8" cy="18.2" r="0.8" fill="#F0F0F0"/>
  <circle cx="37" cy="19" r="2.5" fill="#1A1008"/>
  <circle cx="37.8" cy="18.2" r="0.8" fill="#F0F0F0"/>
  <ellipse cx="32" cy="24" rx="2" ry="1.5" fill="#1A1008"/>
  <path d="M30 25.5 Q32 27.5 34 25.5" stroke="#1A1008" stroke-width="0.8" fill="none" stroke-linecap="round"/>
  <ellipse cx="32" cy="34" rx="8" ry="6" fill="#F0F0F0" opacity="0.7"/>
  <ellipse cx="24" cy="50" rx="4" ry="3" fill="#E89B1D"/>
  <ellipse cx="40" cy="50" rx="4" ry="3" fill="#E89B1D"/>
  <ellipse cx="49" cy="36" rx="3" ry="2" fill="#B06E15" transform="rotate(-30 49 36)"/>
</svg>`;

/**
 * Ducky mascot as a 32×32 favicon SVG — circular crop with amber background.
 * Designed to be legible at small sizes (browser tab icon).
 */
export const DUCKY_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="16" fill="#FDE68A"/>
  <g transform="translate(4,2) scale(0.375)">
    <ellipse cx="32" cy="38" rx="18" ry="16" fill="#F5A623"/>
    <circle cx="32" cy="20" r="14" fill="#F5A623"/>
    <ellipse cx="19" cy="16" rx="6" ry="10" fill="#C47A1A" transform="rotate(-15 19 16)"/>
    <ellipse cx="45" cy="16" rx="6" ry="10" fill="#C47A1A" transform="rotate(15 45 16)"/>
    <ellipse cx="32" cy="18" rx="5" ry="7" fill="#FFFFFF" opacity="0.85"/>
    <circle cx="27" cy="19" r="2.5" fill="#2D1B0E"/>
    <circle cx="27.8" cy="18.2" r="0.8" fill="#FFFFFF"/>
    <circle cx="37" cy="19" r="2.5" fill="#2D1B0E"/>
    <circle cx="37.8" cy="18.2" r="0.8" fill="#FFFFFF"/>
    <ellipse cx="32" cy="24" rx="2" ry="1.5" fill="#2D1B0E"/>
    <path d="M30 25.5 Q32 27.5 34 25.5" stroke="#2D1B0E" stroke-width="0.8" fill="none" stroke-linecap="round"/>
    <ellipse cx="32" cy="34" rx="8" ry="6" fill="#FFFFFF" opacity="0.7"/>
  </g>
</svg>`;
