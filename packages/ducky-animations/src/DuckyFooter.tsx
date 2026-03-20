import type { DuckyFooterProps } from "./types";
import { DuckyAnimation } from "./DuckyAnimation";

const DEFAULT_TAGLINE = "Powered by Ducky Intelligence.";

/**
 * Standard footer branding component.
 * Displays "Powered by Ducky Intelligence." with an optional mini mascot.
 * Required in all Cavaridge apps per branding standards.
 */
export function DuckyFooter({
  showMascot = true,
  tagline = DEFAULT_TAGLINE,
  className = "",
  theme,
}: DuckyFooterProps) {
  const isDark = theme === "dark";

  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "8px 0",
        fontSize: 12,
        color: isDark ? "#A0AEC0" : "#6B7280",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
      data-ducky-theme={theme ?? "system"}
    >
      {showMascot && <DuckyAnimation state="idle" size="sm" theme={theme} />}
      <span>{tagline}</span>
    </div>
  );
}
