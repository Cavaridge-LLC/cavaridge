/**
 * Ducky Intelligence Mascot — Placeholder Component
 *
 * This component will be replaced with the full Lottie animation player
 * from @cavaridge/ducky-animations once that package ships.
 *
 * 9 animation states planned: idle, listening, thinking, searching,
 * found, presenting, error, celebrating, sleeping.
 *
 * For now, renders a static placeholder that matches the Ducky character design.
 */

export type DuckyState =
  | "idle"
  | "listening"
  | "thinking"
  | "searching"
  | "found"
  | "presenting"
  | "error"
  | "celebrating"
  | "sleeping";

interface DuckyMascotProps {
  state?: DuckyState;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
};

const STATE_LABELS: Record<DuckyState, string> = {
  idle: "",
  listening: "Listening...",
  thinking: "Thinking...",
  searching: "Searching...",
  found: "Found it!",
  presenting: "Here you go",
  error: "Oops!",
  celebrating: "Done!",
  sleeping: "Zzz...",
};

export function DuckyMascot({ state = "idle", size = "md", className = "" }: DuckyMascotProps) {
  const sizeClass = SIZE_MAP[size];
  const isAnimated = state === "thinking" || state === "searching" || state === "listening";

  return (
    <div className={`inline-flex items-center gap-2 ${className}`} title={`Ducky Intelligence — ${state}`}>
      <div
        className={`${sizeClass} rounded-full bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-800 dark:to-amber-900 flex items-center justify-center border-2 border-amber-300 dark:border-amber-700 ${isAnimated ? "animate-pulse" : ""}`}
      >
        {/* Placeholder: Cavalier King Charles Spaniel emoji until Lottie animations ship */}
        <span className={size === "sm" ? "text-sm" : size === "md" ? "text-lg" : "text-2xl"} role="img" aria-label="Ducky mascot">
          🐶
        </span>
      </div>
      {state !== "idle" && STATE_LABELS[state] && (
        <span className="text-xs text-slate-500 dark:text-slate-400 italic">
          {STATE_LABELS[state]}
        </span>
      )}
    </div>
  );
}
