/**
 * Ducky Intelligence Mascot — Forge variant.
 *
 * Renders the actual Blenheim Cavalier SVG via @cavaridge/branding
 * with Forge-specific states and content creation messages.
 */

import { DuckyMascotImage } from "@cavaridge/branding";
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

interface Props {
  state: DuckyState;
  size?: "sm" | "md" | "lg";
  showMessage?: boolean;
  className?: string;
}

export default function DuckyMascot({ state, size = "md", showMessage = true, className }: Props) {
  const isAnimating = ["thinking", "planning", "building", "reviewing", "determined"].includes(state);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className={cn(
        isAnimating && "animate-bounce",
        state === "celebrating" && "animate-pulse",
      )}>
        <DuckyMascotImage size={size} showContainer={false} />
      </div>
      {showMessage && (
        <p className="text-sm text-muted-foreground text-center">
          {DUCKY_MESSAGES[state]}
        </p>
      )}
    </div>
  );
}
