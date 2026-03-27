/**
 * Ducky Intelligence Mascot — HIPAA variant.
 *
 * Renders the actual Blenheim Cavalier SVG via @cavaridge/branding
 * with HIPAA-specific states and domain messages.
 */

import { DuckyMascotImage } from "@cavaridge/branding";
import { cn } from "@/lib/utils";

export type DuckyState =
  | "idle" | "thinking" | "assessing" | "finding"
  | "celebrating" | "concerned" | "reporting" | "reviewing";

const DUCKY_MESSAGES: Record<DuckyState, string> = {
  idle: "Ready to assess your HIPAA compliance!",
  thinking: "Analyzing control requirements...",
  assessing: "Running risk assessment...",
  finding: "Identifying compliance gaps...",
  celebrating: "Assessment complete!",
  concerned: "Critical findings detected.",
  reporting: "Generating compliance report...",
  reviewing: "Reviewing remediation progress...",
};

interface Props {
  state: DuckyState;
  size?: "sm" | "md" | "lg";
  showMessage?: boolean;
  className?: string;
}

export default function DuckyMascot({ state, size = "md", showMessage = true, className }: Props) {
  const isAnimating = ["thinking", "assessing", "finding", "reporting", "reviewing"].includes(state);

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
