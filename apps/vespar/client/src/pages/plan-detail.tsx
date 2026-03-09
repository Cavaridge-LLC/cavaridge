import { Link, useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Cloud, Check, ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { MigrationPlan } from "@shared/schema";

const SOURCES: Record<string, string> = {
  onprem: "On-Premises",
  aws: "Amazon Web Services",
  azure: "Microsoft Azure",
  gcp: "Google Cloud",
};

const DESTINATIONS: Record<string, string> = {
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
};

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: plan, isLoading, error } = useQuery<MigrationPlan>({
    queryKey: [`/api/migration-plans/${id}`],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-16 h-16 relative">
          <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-heading font-bold">Plan not found</h1>
        <Button onClick={() => setLocation("/history")} variant="outline" className="rounded-full">
          Back to Plans
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="p-6 flex justify-between items-center glass-panel sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-sm">
            <Cloud size={20} />
          </div>
          <span className="font-heading font-bold text-xl tracking-tight">SkyShift</span>
        </Link>
        <Button onClick={() => setLocation("/history")} variant="ghost" className="rounded-full px-6" data-testid="btn-back-history">
          <ChevronLeft className="mr-1 h-4 w-4" />
          All Plans
        </Button>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-10 animate-in fade-in duration-500">
          <h1 className="text-3xl font-bold font-heading mb-2">
            {SOURCES[plan.source]} → {DESTINATIONS[plan.destination]}
          </h1>
          <p className="text-muted-foreground">
            Created on {new Date(plan.createdAt).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        <div className="w-full bg-white rounded-3xl border border-border/50 shadow-lg overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-700">
          <div className="p-6 bg-secondary/20 border-b border-border/50 flex justify-between items-center">
            <div>
              <h3 className="font-heading font-bold text-lg text-foreground">Migration Summary</h3>
              <p className="text-sm text-muted-foreground">Estimated Phase 1</p>
            </div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${
              plan.riskLevel === "Low Risk" ? "bg-green-50 text-green-700 ring-green-200" :
              plan.riskLevel === "Medium Risk" ? "bg-yellow-50 text-yellow-700 ring-yellow-200" :
              "bg-red-50 text-red-700 ring-red-200"
            }`}>
              {plan.riskLevel}
            </span>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center p-4 rounded-2xl bg-muted/50">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground mb-1">Timeline</span>
                <span className="font-heading font-bold text-xl">{plan.timelineEstimate}</span>
              </div>
              <div className="w-px h-12 bg-border"></div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground mb-1">Downtime</span>
                <span className="font-heading font-bold text-xl">{plan.downtimeEstimate}</span>
              </div>
              <div className="w-px h-12 bg-border"></div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground mb-1">Complexity</span>
                <span className={`font-heading font-bold text-xl ${
                  plan.complexity === "Low" ? "text-green-600" :
                  plan.complexity === "Moderate" ? "text-yellow-600" : "text-red-600"
                }`}>{plan.complexity}</span>
              </div>
            </div>

            <div>
              <h4 className="font-heading font-semibold mb-3 text-foreground">Recommended Next Steps</h4>
              <ul className="space-y-3">
                {(plan.steps as string[]).map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-primary/20 p-1"><Check size={12} className="text-primary"/></div>
                    <span className="text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="p-6 bg-muted/30 border-t border-border/50 flex gap-4">
            <Button className="flex-1 rounded-full h-12 text-base" onClick={() => setLocation("/wizard")} data-testid="btn-new-from-detail">
              Create New Plan
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">Plan ID: {plan.id}</p>
      </main>

      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/40">
        © 2026 Cavaridge, LLC. All rights reserved.
      </footer>
    </div>
  );
}