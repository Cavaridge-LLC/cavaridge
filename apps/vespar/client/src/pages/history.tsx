import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Cloud, ArrowRight, Clock, ChevronRight } from "lucide-react";
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

export default function History() {
  const [, setLocation] = useLocation();

  const { data: plans, isLoading } = useQuery<MigrationPlan[]>({
    queryKey: ["/api/migration-plans"],
  });

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="p-6 flex justify-between items-center glass-panel sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-sm">
            <Cloud size={20} />
          </div>
          <span className="font-heading font-bold text-xl tracking-tight">SkyShift</span>
        </Link>
        <Button onClick={() => setLocation("/wizard")} className="rounded-full px-6 shadow-sm" data-testid="btn-new-plan">
          New Plan
        </Button>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10 text-center sm:text-left">
          <h1 className="text-4xl font-bold font-heading mb-4">Your Migration Plans</h1>
          <p className="text-lg text-muted-foreground">View and revisit your previously generated blueprints.</p>
        </div>

        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 relative">
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        )}

        {!isLoading && plans && plans.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="text-muted-foreground" size={36} />
            </div>
            <h2 className="text-xl font-heading font-semibold mb-2">No plans yet</h2>
            <p className="text-muted-foreground mb-6">Start by designing your first migration plan.</p>
            <Button onClick={() => setLocation("/wizard")} className="rounded-full px-8" data-testid="btn-create-first">
              Create Your First Plan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {!isLoading && plans && plans.length > 0 && (
          <div className="space-y-4">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className="rounded-2xl border border-border/50 bg-white hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setLocation(`/plan/${plan.id}`)}
                data-testid={`card-plan-${plan.id}`}
              >
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-heading font-semibold text-lg text-foreground">
                        {SOURCES[plan.source] || plan.source} → {DESTINATIONS[plan.destination] || plan.destination}
                      </h3>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        plan.riskLevel === "Low Risk" ? "bg-green-50 text-green-700 ring-green-200" :
                        plan.riskLevel === "Medium Risk" ? "bg-yellow-50 text-yellow-700 ring-yellow-200" :
                        "bg-red-50 text-red-700 ring-red-200"
                      }`}>
                        {plan.riskLevel}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{plan.resources.length} resource types</span>
                      <span>•</span>
                      <span>{plan.timelineEstimate}</span>
                      <span>•</span>
                      <span>{plan.complexity} complexity</span>
                      <span>•</span>
                      <span>{new Date(plan.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <ChevronRight className="text-muted-foreground" size={20} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/40">
        © 2026 Cavaridge, LLC. All rights reserved.
      </footer>
    </div>
  );
}