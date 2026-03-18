import type { DuckyAnimationProps } from "./types";
import { DUCKY_SIZE_MAP } from "./types";
import "./animations.css";

/**
 * Animated Ducky mascot — Blenheim Cavalier King Charles Spaniel.
 * Supports 9 animation states via CSS keyframes.
 * Placeholder SVG until Lottie animations are produced.
 */
export function DuckyAnimation({ state = "idle", size = "md", className = "" }: DuckyAnimationProps) {
  const px = DUCKY_SIZE_MAP[size];

  return (
    <div
      className={`ducky-${state} inline-flex items-center justify-center ${className}`}
      style={{ width: px, height: px }}
      role="img"
      aria-label={`Ducky mascot — ${state}`}
    >
      <svg
        viewBox="0 0 64 64"
        width={px}
        height={px}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Body — rounded Cavalier shape */}
        <ellipse cx="32" cy="38" rx="18" ry="16" fill="#F5A623" />
        {/* Head */}
        <circle cx="32" cy="20" r="14" fill="#F5A623" />
        {/* Left ear (floppy Cavalier ear) */}
        <ellipse cx="19" cy="16" rx="6" ry="10" fill="#C47A1A" transform="rotate(-15 19 16)" />
        {/* Right ear */}
        <ellipse cx="45" cy="16" rx="6" ry="10" fill="#C47A1A" transform="rotate(15 45 16)" />
        {/* Blenheim blaze (white stripe) */}
        <ellipse cx="32" cy="18" rx="5" ry="7" fill="#FFFFFF" opacity="0.85" />
        {/* Left eye */}
        <circle cx="27" cy="19" r="2.5" fill="#2D1B0E" />
        <circle cx="27.8" cy="18.2" r="0.8" fill="#FFFFFF" />
        {/* Right eye */}
        <circle cx="37" cy="19" r="2.5" fill="#2D1B0E" />
        <circle cx="37.8" cy="18.2" r="0.8" fill="#FFFFFF" />
        {/* Nose */}
        <ellipse cx="32" cy="24" rx="2" ry="1.5" fill="#2D1B0E" />
        {/* Mouth hint */}
        <path d="M30 25.5 Q32 27.5 34 25.5" stroke="#2D1B0E" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        {/* Chest blaze */}
        <ellipse cx="32" cy="34" rx="8" ry="6" fill="#FFFFFF" opacity="0.7" />
        {/* Front paws */}
        <ellipse cx="24" cy="50" rx="4" ry="3" fill="#F5A623" />
        <ellipse cx="40" cy="50" rx="4" ry="3" fill="#F5A623" />
        {/* Tail nub */}
        <ellipse cx="49" cy="36" rx="3" ry="2" fill="#C47A1A" transform="rotate(-30 49 36)" />
      </svg>
    </div>
  );
}
