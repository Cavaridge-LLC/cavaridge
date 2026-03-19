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

const DUCKY_EMOJI: Record<DuckyState, string> = {
  idle: "\u{1F415}",
  thinking: "\u{1F50D}",
  assessing: "\u{1F4CB}",
  finding: "\u{26A0}\uFE0F",
  celebrating: "\u{1F389}",
  concerned: "\u{1F6A8}",
  reporting: "\u{1F4C4}",
  reviewing: "\u{2705}",
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

  const isAnimating = ["thinking", "assessing", "finding", "reporting", "reviewing"].includes(state);

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
