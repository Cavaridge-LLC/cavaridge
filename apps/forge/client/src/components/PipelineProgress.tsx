import DuckyMascot, { type DuckyState } from "./DuckyMascot";
import { Check, Circle, Loader2 } from "lucide-react";

type Stage = "intake" | "research" | "structure" | "generate" | "validate" | "render" | "complete" | "failed";

const STAGES: { key: Stage; label: string }[] = [
  { key: "intake", label: "Analyzing Brief" },
  { key: "research", label: "Researching" },
  { key: "structure", label: "Planning Structure" },
  { key: "generate", label: "Generating Content" },
  { key: "validate", label: "Quality Check" },
  { key: "render", label: "Rendering" },
  { key: "complete", label: "Complete" },
];

interface Props {
  currentStage: Stage;
  duckyState: DuckyState;
  message?: string;
}

export default function PipelineProgress({ currentStage, duckyState, message }: Props) {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStage);
  const isFailed = currentStage === "failed";

  return (
    <div className="bg-card rounded-xl border p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {isFailed ? "Pipeline Failed" : "Building Your Document"}
        </h3>
        <DuckyMascot state={duckyState} size="md" showMessage={false} />
      </div>

      {/* Progress steps */}
      <div className="space-y-3">
        {STAGES.filter((s) => s.key !== "complete").map((stage, i) => {
          const isCompleted = i < currentIndex;
          const isCurrent = stage.key === currentStage;
          const isPending = i > currentIndex;

          return (
            <div key={stage.key} className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                ) : isCurrent ? (
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                  </div>
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground/30" />
                )}
              </div>
              <span className={`text-sm ${
                isCompleted ? "text-muted-foreground line-through" :
                isCurrent ? "text-foreground font-medium" :
                "text-muted-foreground/50"
              }`}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status message */}
      {message && (
        <div className="p-3 bg-secondary rounded-lg">
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      )}

      {/* Ducky message */}
      <DuckyMascot state={duckyState} size="sm" showMessage={true} />
    </div>
  );
}
