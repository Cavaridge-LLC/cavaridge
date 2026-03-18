/**
 * Ducky Mascot Component
 *
 * Displays the Ducky Intelligence mascot with state-appropriate messaging.
 * Uses CSS animations as fallback until @cavaridge/ducky-animations Lottie is wired.
 */

import { cn } from "@/lib/utils";

export type DuckyState =
  | "idle" | "thinking" | "planning" | "building"
  | "reviewing" | "celebrating" | "concerned"
  | "apologetic" | "determined";

const DUCKY_MESSAGES: Record<DuckyState, string> = {
  idle: "Ready to create something amazing!",
  thinking: "Analyzing your brief...",
  planning: "Planning the perfect structure...",
  building: "Generating content...",
  reviewing: "Checking quality...",
  celebrating: "Your document is ready!",
  concerned: "Some quality notes to review.",
  apologetic: "Something went wrong. Let me try again.",
  determined: "Improving quality...",
};

const DUCKY_EMOJI: Record<DuckyState, string> = {
  idle: "🐕",
  thinking: "🔍",
  planning: "📋",
  building: "✍️",
  reviewing: "🔎",
  celebrating: "🎉",
  concerned: "🤔",
  apologetic: "😔",
  determined: "💪",
};

interface Props {
  state: DuckyState;
  size?: "sm" | "md" | "lg";
  showMessage?: boolean;
  className?: string;
}

export default function DuckyMascot({ state, size = "md", showMessage = true, className }: Props) {
  const sizeClasses = {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-6xl",
  };

  const isAnimating = ["thinking", "planning", "building", "reviewing", "determined"].includes(state);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className={cn(
        sizeClasses[size],
        isAnimating && "animate-bounce",
        state === "celebrating" && "animate-pulse",
      )}>
        {DUCKY_EMOJI[state]}
      </div>
      {showMessage && (
        <p className="text-sm text-muted-foreground text-center">
          {DUCKY_MESSAGES[state]}
        </p>
      )}
    </div>
  );
}
