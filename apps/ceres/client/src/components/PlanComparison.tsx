import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Save, BarChart3 } from "lucide-react";

export type SavedPlan = {
  id: string;
  name: string;
  socDate: string;
  frequencyStr: string;
  visits: number[];
  totalVisits: number;
  savedAt: Date;
};

type PlanComparisonProps = {
  plans: SavedPlan[];
  onRemovePlan: (id: string) => void;
  onClose: () => void;
};

type SavePlanButtonProps = {
  currentPlan: { socDate: string; frequencyStr: string; visits: number[]; totalVisits: number };
  savedPlans: SavedPlan[];
  onSave: (plan: SavedPlan) => void;
  maxPlans?: number;
};

function getBarColor(visits: number, max: number): string {
  if (max === 0) return "bg-muted";
  const ratio = visits / max;
  if (ratio >= 0.8) return "bg-primary";
  if (ratio >= 0.5) return "bg-primary/70";
  if (ratio > 0) return "bg-primary/40";
  return "bg-muted";
}

function hasDifference(plans: SavedPlan[], weekIndex: number): boolean {
  if (plans.length < 2) return false;
  const first = plans[0].visits[weekIndex] ?? 0;
  return plans.some((p) => (p.visits[weekIndex] ?? 0) !== first);
}

function getPeriodVisits(visits: number[], period: 1 | 2): number {
  const p1Weeks = Math.min(Math.ceil(30 / 7), visits.length);
  if (period === 1) {
    return visits.slice(0, p1Weeks).reduce((a, b) => a + b, 0);
  }
  return visits.slice(p1Weeks).reduce((a, b) => a + b, 0);
}

export default function PlanComparison({ plans, onRemovePlan, onClose }: PlanComparisonProps) {
  const maxWeeks = Math.max(...plans.map((p) => p.visits.length), 0);
  const maxVisitsPerWeek = Math.max(...plans.flatMap((p) => p.visits), 1);

  const gridCols =
    plans.length <= 2
      ? "grid-cols-1 sm:grid-cols-2"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="w-5 h-5 text-primary" />
          Plan Comparison
        </CardTitle>
        <Button
          data-testid="button-close-comparison"
          variant="ghost"
          size="icon"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`grid ${gridCols} gap-4`}>
          {plans.map((plan) => (
            <Card key={plan.id} data-testid={`card-plan-${plan.id}`} className="border shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{plan.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">SOC: {plan.socDate}</p>
                </div>
                <Button
                  data-testid={`button-remove-plan-${plan.id}`}
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => onRemovePlan(plan.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="font-mono text-sm bg-muted/30 rounded px-2 py-1 break-words border border-border/50">
                  {plan.frequencyStr}
                </div>

                <Badge variant="secondary" data-testid={`badge-total-${plan.id}`}>
                  {plan.totalVisits} total visits
                </Badge>

                <div className="space-y-1">
                  {Array.from({ length: maxWeeks }).map((_, wi) => {
                    const v = plan.visits[wi] ?? 0;
                    const diff = hasDifference(plans, wi);
                    return (
                      <div
                        key={wi}
                        className={`flex items-center gap-2 text-xs rounded px-1 py-0.5 ${
                          diff ? "bg-amber-100 dark:bg-amber-900/30" : ""
                        }`}
                      >
                        <span className="w-7 text-muted-foreground font-medium shrink-0">
                          W{wi + 1}
                        </span>
                        <div className="flex-1 h-4 bg-muted/40 rounded-sm overflow-hidden">
                          <div
                            className={`h-full rounded-sm transition-all ${getBarColor(v, maxVisitsPerWeek)}`}
                            style={{
                              width: maxVisitsPerWeek > 0 ? `${(v / maxVisitsPerWeek) * 100}%` : "0%",
                            }}
                          />
                        </div>
                        <span className="w-4 text-right font-semibold">{v}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  <div className="bg-muted/30 rounded p-2 border border-border/50">
                    <div className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">
                      Period 1
                    </div>
                    <div className="font-bold text-foreground">
                      {getPeriodVisits(plan.visits, 1)} visits
                    </div>
                  </div>
                  <div className="bg-muted/30 rounded p-2 border border-border/50">
                    <div className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">
                      Period 2
                    </div>
                    <div className="font-bold text-foreground">
                      {getPeriodVisits(plan.visits, 2)} visits
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {plans.length >= 2 && (
          <div
            data-testid="summary-comparison"
            className="bg-muted/30 rounded-lg p-4 border border-border/50"
          >
            <h4 className="text-sm font-semibold mb-2">Summary</h4>
            <div className="flex flex-wrap gap-4">
              {plans.map((plan) => (
                <div key={plan.id} className="text-sm">
                  <span className="font-medium">{plan.name}:</span>{" "}
                  <span className="font-bold">{plan.totalVisits}</span> visits
                  <span className="text-muted-foreground ml-1">
                    (P1: {getPeriodVisits(plan.visits, 1)} / P2: {getPeriodVisits(plan.visits, 2)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PLAN_LETTERS = ["A", "B", "C", "D", "E"];

export function SavePlanButton({
  currentPlan,
  savedPlans,
  onSave,
  maxPlans = 3,
}: SavePlanButtonProps) {
  const disabled = savedPlans.length >= maxPlans || currentPlan.totalVisits === 0;

  const handleSave = () => {
    const usedLetters = new Set(
      savedPlans.map((p) => p.name.replace("Plan ", ""))
    );
    const nextLetter =
      PLAN_LETTERS.find((l) => !usedLetters.has(l)) ??
      String.fromCharCode(65 + savedPlans.length);

    const plan: SavedPlan = {
      id: crypto.randomUUID(),
      name: `Plan ${nextLetter}`,
      socDate: currentPlan.socDate,
      frequencyStr: currentPlan.frequencyStr,
      visits: [...currentPlan.visits],
      totalVisits: currentPlan.totalVisits,
      savedAt: new Date(),
    };
    onSave(plan);
  };

  return (
    <Button
      data-testid="button-save-plan"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={handleSave}
    >
      <Save className="w-4 h-4 mr-2" />
      Save Plan
      {savedPlans.length > 0 && (
        <span className="ml-1 text-muted-foreground">
          ({savedPlans.length}/{maxPlans})
        </span>
      )}
    </Button>
  );
}
