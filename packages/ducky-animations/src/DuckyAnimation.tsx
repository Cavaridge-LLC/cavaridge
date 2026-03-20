import type { DuckyAnimationProps } from "./types";
import { DUCKY_SIZE_MAP } from "./types";

/**
 * Cavalier King Charles Spaniel (Blenheim) SVG with CSS animation states.
 * Placeholder until Lottie files are produced from the character design pipeline.
 *
 * Works in React web contexts. For React Native, use the Lottie-based
 * replacement when animation files are available.
 */
export function DuckyAnimation({
  state = "idle",
  size = "md",
  className = "",
  theme,
}: DuckyAnimationProps) {
  const px = DUCKY_SIZE_MAP[size];
  const isDark = theme === "dark";

  // Blenheim Cavalier colors — slight adjustment for dark backgrounds
  const bodyFill = isDark ? "#E89B1D" : "#F5A623";
  const earFill = isDark ? "#B06E15" : "#C47A1A";
  const whiteFill = isDark ? "#F0F0F0" : "#FFFFFF";
  const darkFill = isDark ? "#1A1008" : "#2D1B0E";

  return (
    <div
      className={`ducky-animation ducky-${state} ${className}`}
      style={{
        width: px,
        height: px,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      role="img"
      aria-label={`Ducky mascot — ${state}`}
      data-ducky-state={state}
      data-ducky-theme={theme ?? "system"}
    >
      <svg
        viewBox="0 0 64 64"
        width={px}
        height={px}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Body — rounded Cavalier shape */}
        <ellipse cx="32" cy="38" rx="18" ry="16" fill={bodyFill} />
        {/* Head */}
        <circle cx="32" cy="20" r="14" fill={bodyFill} />
        {/* Left ear (floppy Cavalier ear) */}
        <ellipse cx="19" cy="16" rx="6" ry="10" fill={earFill} transform="rotate(-15 19 16)" />
        {/* Right ear */}
        <ellipse cx="45" cy="16" rx="6" ry="10" fill={earFill} transform="rotate(15 45 16)" />
        {/* Blenheim blaze (white stripe) */}
        <ellipse cx="32" cy="18" rx="5" ry="7" fill={whiteFill} opacity="0.85" />
        {/* Left eye */}
        <circle cx="27" cy="19" r="2.5" fill={darkFill} />
        <circle cx="27.8" cy="18.2" r="0.8" fill={whiteFill} />
        {/* Right eye */}
        <circle cx="37" cy="19" r="2.5" fill={darkFill} />
        <circle cx="37.8" cy="18.2" r="0.8" fill={whiteFill} />
        {/* Nose */}
        <ellipse cx="32" cy="24" rx="2" ry="1.5" fill={darkFill} />
        {/* Mouth hint */}
        <path
          d="M30 25.5 Q32 27.5 34 25.5"
          stroke={darkFill}
          strokeWidth="0.8"
          fill="none"
          strokeLinecap="round"
        />
        {/* Chest blaze */}
        <ellipse cx="32" cy="34" rx="8" ry="6" fill={whiteFill} opacity="0.7" />
        {/* Front paws */}
        <ellipse cx="24" cy="50" rx="4" ry="3" fill={bodyFill} />
        <ellipse cx="40" cy="50" rx="4" ry="3" fill={bodyFill} />
        {/* Tail nub */}
        <ellipse cx="49" cy="36" rx="3" ry="2" fill={earFill} transform="rotate(-30 49 36)" />

        {/* State-specific overlays */}
        {state === "sleeping" && (
          <g opacity="0.6">
            <text x="46" y="12" fontSize="8" fill={isDark ? "#A0AEC0" : "#718096"}>z</text>
            <text x="50" y="7" fontSize="6" fill={isDark ? "#A0AEC0" : "#718096"}>z</text>
            <text x="53" y="3" fontSize="4" fill={isDark ? "#A0AEC0" : "#718096"}>z</text>
          </g>
        )}
        {state === "error" && (
          <g>
            {/* Concerned eyebrows */}
            <line x1="24" y1="15" x2="29" y2="16" stroke={darkFill} strokeWidth="1" strokeLinecap="round" />
            <line x1="40" y1="15" x2="35" y2="16" stroke={darkFill} strokeWidth="1" strokeLinecap="round" />
          </g>
        )}
        {state === "found" && (
          <g opacity="0.8">
            <text x="44" y="10" fontSize="10" fill="#F59E0B">!</text>
          </g>
        )}
      </svg>
    </div>
  );
}
