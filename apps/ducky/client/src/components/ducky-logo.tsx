/**
 * DuckyLogo — Blenheim Cavalier King Charles Spaniel mascot
 *
 * Ducky is Cavaridge's AI companion across all apps.
 * The mascot is a Blenheim Cavalier (chestnut + white), NOT a duck.
 */

const SIZES = {
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
} as const;

interface DuckyLogoProps {
  size?: keyof typeof SIZES;
  className?: string;
}

export function DuckyLogo({ size = "md", className = "" }: DuckyLogoProps) {
  const px = SIZES[size];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Ducky mascot"
      className={className}
    >
      {/* Body — white/cream base */}
      <ellipse cx="32" cy="40" rx="18" ry="16" fill="#FEF3C7" />
      {/* Chestnut patches (Blenheim coloring) */}
      <ellipse cx="26" cy="36" rx="8" ry="6" fill="#B45309" opacity="0.85" />
      <ellipse cx="38" cy="36" rx="8" ry="6" fill="#B45309" opacity="0.85" />
      {/* Head */}
      <circle cx="32" cy="22" r="14" fill="#FEF3C7" />
      {/* Ear — left (chestnut, droopy Cavalier ear) */}
      <ellipse cx="18" cy="26" rx="7" ry="11" fill="#B45309" transform="rotate(-10 18 26)" />
      {/* Ear — right */}
      <ellipse cx="46" cy="26" rx="7" ry="11" fill="#B45309" transform="rotate(10 46 26)" />
      {/* Chestnut head patch (Blenheim blaze inverted) */}
      <ellipse cx="32" cy="17" rx="6" ry="4" fill="#D97706" opacity="0.7" />
      {/* Eyes */}
      <circle cx="27" cy="22" r="2.5" fill="#1C1917" />
      <circle cx="37" cy="22" r="2.5" fill="#1C1917" />
      {/* Eye highlights */}
      <circle cx="27.8" cy="21.2" r="0.8" fill="white" />
      <circle cx="37.8" cy="21.2" r="0.8" fill="white" />
      {/* Nose */}
      <ellipse cx="32" cy="27" rx="2.5" ry="1.8" fill="#1C1917" />
      {/* Mouth */}
      <path d="M30 29 Q32 31 34 29" stroke="#1C1917" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      {/* Tail (wagging!) */}
      <path d="M50 38 Q56 30 54 24" stroke="#B45309" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Front paws */}
      <ellipse cx="26" cy="54" rx="4" ry="2.5" fill="#FEF3C7" />
      <ellipse cx="38" cy="54" rx="4" ry="2.5" fill="#FEF3C7" />
    </svg>
  );
}
