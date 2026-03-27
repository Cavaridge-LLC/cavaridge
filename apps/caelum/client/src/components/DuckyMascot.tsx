/**
 * Ducky Intelligence Mascot — renders the actual Blenheim Cavalier SVG.
 *
 * Wraps @cavaridge/branding DuckyMascotImage with the state label API
 * that Caelum components expect. When @cavaridge/ducky-animations Lottie
 * files ship, this component will switch to the animated version.
 */

import { DuckyMascotImage } from "@cavaridge/branding";
import type { DuckyMascotImageSize } from "@cavaridge/branding";

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
  size?: DuckyMascotImageSize;
  className?: string;
}

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
  const isAnimated = state === "thinking" || state === "searching" || state === "listening";

  return (
    <div className={`inline-flex items-center gap-2 ${className}`} title={`Ducky Intelligence — ${state}`}>
      <div className={isAnimated ? "animate-pulse" : ""}>
        <DuckyMascotImage size={size} />
      </div>
      {state !== "idle" && STATE_LABELS[state] && (
        <span className="text-xs text-slate-500 dark:text-slate-400 italic">
          {STATE_LABELS[state]}
        </span>
      )}
    </div>
  );
}
