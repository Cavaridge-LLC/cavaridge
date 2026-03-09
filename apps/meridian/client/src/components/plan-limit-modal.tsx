import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowUpCircle, Users, Briefcase, HardDrive, FileText, MessageSquare, Layers } from "lucide-react";
import { useAuth, type PlanTier } from "@/lib/auth";

const LIMIT_LABELS: Record<string, { label: string; icon: typeof Users; unit: string }> = {
  users: { label: "Team Members", icon: Users, unit: "users" },
  deals: { label: "Active Deals", icon: Briefcase, unit: "deals" },
  storage: { label: "Storage", icon: HardDrive, unit: "GB" },
  documents: { label: "Documents per Deal", icon: FileText, unit: "documents" },
  queries: { label: "AI Queries", icon: MessageSquare, unit: "queries/month" },
  baselines: { label: "Baseline Profiles", icon: Layers, unit: "profiles" },
};

const TIER_UPGRADE: Record<string, { label: string; color: string }> = {
  starter: { label: "Professional", color: "text-blue-400" },
  professional: { label: "Enterprise", color: "text-amber-400" },
  enterprise: { label: "Enterprise", color: "text-amber-400" },
};

interface PlanLimitModalProps {
  open: boolean;
  onClose: () => void;
  limitType: string;
  current: number;
  limit: number;
  planTier: PlanTier;
}

export function PlanLimitModal({ open, onClose, limitType, current, limit, planTier }: PlanLimitModalProps) {
  const meta = LIMIT_LABELS[limitType] || { label: limitType, icon: AlertTriangle, unit: "" };
  const Icon = meta.icon;
  const upgrade = TIER_UPGRADE[planTier] || TIER_UPGRADE.starter;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-[var(--theme-border)] sm:max-w-md" style={{ background: "var(--bg-card)" }}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-[var(--text-primary)] text-base">Plan Limit Reached</DialogTitle>
              <DialogDescription className="text-[var(--text-disabled)] text-xs mt-0.5">
                You've reached the maximum for your current plan
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex items-center justify-between p-3 rounded-md bg-[var(--bg-panel)] border border-[var(--theme-border)]">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
              <span className="text-sm text-[var(--text-primary)]">{meta.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-data text-sm text-amber-400" data-testid="text-limit-current">{current}</span>
              <span className="text-[var(--text-disabled)] text-xs">/</span>
              <span className="font-data text-sm text-[var(--text-secondary)]" data-testid="text-limit-max">{limit}</span>
              <span className="text-[10px] text-[var(--text-disabled)]">{meta.unit}</span>
            </div>
          </div>

          <div className="w-full bg-[var(--bg-panel)] rounded-full h-1.5">
            <div
              className="bg-amber-500 h-1.5 rounded-full"
              style={{ width: "100%" }}
            />
          </div>

          <div className="p-3 rounded-md border border-blue-500/20 bg-blue-500/5">
            <div className="flex items-start gap-2">
              <ArrowUpCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-[var(--text-primary)]">
                  Upgrade to{" "}
                  <span className={`font-semibold ${upgrade.color}`}>{upgrade.label}</span>
                </p>
                <p className="text-xs text-[var(--text-disabled)] mt-1">
                  Get higher limits, advanced features, and priority support.
                  Contact your account owner to upgrade.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Badge
              variant="outline"
              className={`text-[10px] font-data px-1.5 py-0 h-5 no-default-hover-elevate no-default-active-elevate ${
                planTier === "enterprise"
                  ? "border-amber-500/40 text-amber-400"
                  : planTier === "professional"
                  ? "border-blue-500/40 text-blue-400"
                  : "border-[var(--theme-border)] text-[var(--text-disabled)]"
              }`}
            >
              Current: {planTier.charAt(0).toUpperCase() + planTier.slice(1)}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="border-[var(--theme-border)] text-[var(--text-secondary)]"
              onClick={onClose}
              data-testid="button-close-limit-modal"
            >
              Got it
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function usePlanLimitHandler() {
  const { planTier } = useAuth();

  const handleLimitError = (error: any): { limitType: string; current: number; limit: number; planTier: PlanTier } | null => {
    if (error?.limitType) {
      return {
        limitType: error.limitType,
        current: error.current ?? 0,
        limit: error.limit ?? 0,
        planTier: (error.planTier || planTier) as PlanTier,
      };
    }
    return null;
  };

  return { handleLimitError };
}
