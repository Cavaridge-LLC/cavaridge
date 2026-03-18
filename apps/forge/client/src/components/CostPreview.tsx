import { Coins, Clock, Loader2 } from "lucide-react";
import DuckyMascot from "./DuckyMascot";

interface CostEstimate {
  researchCredits: number;
  generationCredits: number;
  renderingCredits: number;
  totalCredits: number;
  breakdown: { label: string; credits: number; detail: string }[];
  estimatedDurationMinutes: number;
}

interface Props {
  estimate: CostEstimate;
  creditBalance: number;
  onApprove: () => void;
  onCancel: () => void;
  loading: boolean;
}

export default function CostPreview({ estimate, creditBalance, onApprove, onCancel, loading }: Props) {
  const canAfford = creditBalance >= estimate.totalCredits;

  return (
    <div className="bg-card rounded-xl border p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">Cost Estimate</h3>
          <p className="text-sm text-muted-foreground">Review before proceeding</p>
        </div>
        <DuckyMascot state="idle" size="sm" showMessage={false} />
      </div>

      {/* Breakdown */}
      <div className="space-y-3">
        {estimate.breakdown.map((item, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
            </div>
            <span className="text-sm font-mono">{item.credits} credits</span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          <span className="font-semibold">Total</span>
        </div>
        <span className="text-lg font-bold text-primary">{estimate.totalCredits} credits</span>
      </div>

      {/* Duration */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Estimated time: ~{estimate.estimatedDurationMinutes} minutes</span>
      </div>

      {/* Balance check */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Your balance:</span>
        <span className={canAfford ? "text-foreground" : "text-destructive font-medium"}>
          {creditBalance} credits {!canAfford && "(insufficient)"}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2 px-4 border rounded-lg text-foreground hover:bg-secondary transition"
        >
          Cancel
        </button>
        <button
          onClick={onApprove}
          disabled={loading || !canAfford}
          className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            "Approve & Build"
          )}
        </button>
      </div>
    </div>
  );
}
