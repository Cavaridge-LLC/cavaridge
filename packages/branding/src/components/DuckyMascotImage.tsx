import { DUCKY_MASCOT_SVG_LIGHT, DUCKY_MASCOT_SVG_DARK } from "../assets/ducky-mascot";

export type DuckyMascotImageSize = "sm" | "md" | "lg";

interface DuckyMascotImageProps {
  size?: DuckyMascotImageSize;
  theme?: "light" | "dark";
  className?: string;
  /** Show the amber gradient circle container. Default: true. */
  showContainer?: boolean;
}

const CONTAINER_SIZE: Record<DuckyMascotImageSize, string> = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
};

const SVG_SIZE: Record<DuckyMascotImageSize, string> = {
  sm: "w-5 h-5",
  md: "w-8 h-8",
  lg: "w-11 h-11",
};

/**
 * Static Ducky mascot image — renders the actual Blenheim Cavalier SVG.
 * Replaces the 🐶 emoji placeholder across all apps.
 *
 * Uses an inline SVG via dangerouslySetInnerHTML for crisp rendering
 * at all sizes. The SVG content is a trusted constant from the branding
 * package — not user input.
 */
export function DuckyMascotImage({
  size = "md",
  theme,
  className = "",
  showContainer = true,
}: DuckyMascotImageProps) {
  const svgContent = theme === "dark" ? DUCKY_MASCOT_SVG_DARK : DUCKY_MASCOT_SVG_LIGHT;

  const svgElement = (
    <div
      className={SVG_SIZE[size]}
      role="img"
      aria-label="Ducky — Cavaridge Intelligence mascot"
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );

  if (!showContainer) {
    return <div className={className}>{svgElement}</div>;
  }

  return (
    <div
      className={`${CONTAINER_SIZE[size]} rounded-full bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-800 dark:to-amber-900 flex items-center justify-center border-2 border-amber-300 dark:border-amber-700 ${className}`}
      title="Ducky Intelligence"
    >
      {svgElement}
    </div>
  );
}
