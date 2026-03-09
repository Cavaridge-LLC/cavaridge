import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Cloud, Server, Database, FileText, ChevronLeft, ArrowRight, Laptop, Building2, CheckCircle2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { MigrationPlan } from "@shared/schema";

type Step = "source" | "destination" | "resources" | "result";

const SOURCES = [
  { id: "onprem", name: "On-Premises", desc: "Physical servers in your office", icon: Building2 },
  { id: "aws", name: "Amazon Web Services", desc: "Currently in AWS", icon: Cloud },
  { id: "azure", name: "Microsoft Azure", desc: "Currently in Azure", icon: Cloud },
  { id: "gcp", name: "Google Cloud", desc: "Currently in GCP", icon: Cloud },
];

const DESTINATIONS = [
  { id: "aws", name: "AWS", desc: "Amazon Web Services", icon: Cloud },
  { id: "azure", name: "Azure", desc: "Microsoft Azure", icon: Cloud },
  { id: "gcp", name: "GCP", desc: "Google Cloud Platform", icon: Cloud },
];

const RESOURCES = [
  { id: "web", name: "Websites & Apps", desc: "Customer facing applications", icon: Laptop },
  { id: "db", name: "Databases", desc: "Customer data, records, info", icon: Database },
  { id: "files", name: "Files & Storage", desc: "Documents, images, backups", icon: FileText },
  { id: "servers", name: "Internal Tools", desc: "Software your team uses", icon: Server },
];

export default function MigrationWizard() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState<Step>("source");
  const [source, setSource] = useState<string | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [resources, setResources] = useState<string[]>([]);
  const [plan, setPlan] = useState<MigrationPlan | null>(null);

  const steps = ["source", "destination", "resources", "result"];
  const progress = ((steps.indexOf(currentStep)) / (steps.length - 1)) * 100;

  const generateMutation = useMutation({
    mutationFn: async (data: { source: string; destination: string; resources: string[] }) => {
      const res = await apiRequest("POST", "/api/migration-plans", data);
      return res.json() as Promise<MigrationPlan>;
    },
    onSuccess: (data) => {
      setPlan(data);
      setCurrentStep("result");
    },
  });

  const handleNext = () => {
    if (currentStep === "source" && source) setCurrentStep("destination");
    else if (currentStep === "destination" && destination) setCurrentStep("resources");
    else if (currentStep === "resources" && resources.length > 0 && source && destination) {
      generateMutation.mutate({ source, destination, resources });
    }
  };

  const handleBack = () => {
    if (currentStep === "destination") setCurrentStep("source");
    else if (currentStep === "resources") setCurrentStep("destination");
  };

  const toggleResource = (id: string) => {
    setResources(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleStartOver = () => {
    setSource(null);
    setDestination(null);
    setResources([]);
    setPlan(null);
    setCurrentStep("source");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="p-6 flex justify-between items-center glass-panel sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-sm">
            <Cloud size={20} />
          </div>
          <span className="font-heading font-bold text-xl tracking-tight">SkyShift</span>
        </Link>
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Migration Designer</span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12 flex flex-col">
        {currentStep !== "result" && (
          <div className="mb-12 animate-in fade-in duration-500">
            <div className="flex justify-between mb-2 px-1">
              <span className="text-sm font-medium text-primary">Step {steps.indexOf(currentStep) + 1} of 3</span>
              <span className="text-sm font-medium text-muted-foreground">
                {currentStep === "source" ? "Source" : currentStep === "destination" ? "Destination" : "Resources"}
              </span>
            </div>
            <Progress value={progress} className="h-2 rounded-full bg-primary/10" />
          </div>
        )}

        <div className="flex-1 flex flex-col">
          {currentStep === "source" && (
            <div className="animate-in slide-in-from-right-8 fade-in duration-500 flex-1">
              <div className="mb-10 text-center sm:text-left">
                <h1 className="text-4xl font-bold font-heading mb-4">Where are you starting from?</h1>
                <p className="text-lg text-muted-foreground">Select your current infrastructure setup.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                {SOURCES.map((s) => (
                  <Card 
                    key={s.id}
                    className={`cursor-pointer transition-all duration-200 border-2 rounded-2xl hover:shadow-md ${source === s.id ? 'step-active' : 'border-border/50 bg-white hover:border-primary/30'}`}
                    onClick={() => setSource(s.id)}
                    data-testid={`card-source-${s.id}`}
                  >
                    <CardContent className="p-6 flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${source === s.id ? 'bg-primary text-white shadow-md' : 'bg-secondary/50 text-foreground'}`}>
                        <s.icon size={24} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold font-heading text-lg mb-1 flex items-center justify-between">
                          {s.name}
                          {source === s.id && <CheckCircle2 className="text-primary" size={20} />}
                        </h3>
                        <p className="text-sm text-muted-foreground">{s.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {currentStep === "destination" && (
            <div className="animate-in slide-in-from-right-8 fade-in duration-500 flex-1">
              <div className="mb-10 text-center sm:text-left">
                <h1 className="text-4xl font-bold font-heading mb-4">Where do you want to go?</h1>
                <p className="text-lg text-muted-foreground">Select your target cloud platform.</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-4 mb-8">
                {DESTINATIONS.map((d) => (
                  <Card 
                    key={d.id}
                    className={`cursor-pointer transition-all duration-200 border-2 rounded-2xl hover:shadow-md ${destination === d.id ? 'step-active' : 'border-border/50 bg-white hover:border-primary/30'}`}
                    onClick={() => setDestination(d.id)}
                    data-testid={`card-dest-${d.id}`}
                  >
                    <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                      <div className={`p-4 rounded-2xl ${destination === d.id ? 'bg-primary text-white shadow-md' : 'bg-secondary/50 text-foreground'}`}>
                        <d.icon size={32} />
                      </div>
                      <div>
                        <h3 className="font-bold font-heading text-xl mb-1 flex items-center justify-center gap-2">
                          {d.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">{d.desc}</p>
                      </div>
                      {destination === d.id && (
                        <div className="absolute top-4 right-4">
                          <CheckCircle2 className="text-primary" size={24} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {currentStep === "resources" && (
            <div className="animate-in slide-in-from-right-8 fade-in duration-500 flex-1">
              <div className="mb-10 text-center sm:text-left">
                <h1 className="text-4xl font-bold font-heading mb-4">What do you need to move?</h1>
                <p className="text-lg text-muted-foreground">Select all that apply. Don't worry, you can change this later.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                {RESOURCES.map((r) => {
                  const isSelected = resources.includes(r.id);
                  return (
                    <Card 
                      key={r.id}
                      className={`cursor-pointer transition-all duration-200 border-2 rounded-2xl hover:shadow-md ${isSelected ? 'step-active' : 'border-border/50 bg-white hover:border-primary/30'}`}
                      onClick={() => toggleResource(r.id)}
                      data-testid={`card-resource-${r.id}`}
                    >
                      <CardContent className="p-6 flex items-start gap-4">
                        <div className={`mt-1 flex items-center justify-center w-6 h-6 rounded border ${isSelected ? 'bg-primary border-primary text-white' : 'border-input bg-transparent'}`}>
                          {isSelected && <Check size={14} strokeWidth={3} />}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold font-heading text-lg mb-1 flex items-center gap-2">
                            <r.icon size={18} className={isSelected ? "text-primary" : "text-muted-foreground"} />
                            {r.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">{r.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {generateMutation.isPending && (
            <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center flex-col animate-in fade-in">
              <div className="w-20 h-20 mb-6 relative">
                <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <Cloud className="absolute inset-0 m-auto text-primary animate-pulse" size={32} />
              </div>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-2">Architecting your migration...</h2>
              <p className="text-muted-foreground">Analyzing paths from {SOURCES.find(s=>s.id === source)?.name} to {DESTINATIONS.find(d=>d.id === destination)?.name}</p>
            </div>
          )}

          {currentStep === "result" && plan && (
            <div className="animate-in slide-in-from-bottom-8 fade-in duration-700 flex-1 flex flex-col items-center py-8">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-8 shadow-sm">
                <CheckCircle2 size={40} strokeWidth={2.5} />
              </div>
              
              <h1 className="text-4xl font-bold font-heading mb-4 text-center">Your Blueprint is Ready</h1>
              <p className="text-lg text-muted-foreground text-center max-w-xl mb-10">
                We've drafted a high-level plan to move your {plan.resources.length} resource types from {SOURCES.find(s=>s.id === plan.source)?.name} to {DESTINATIONS.find(d=>d.id === plan.destination)?.name}.
              </p>

              <div className="w-full max-w-2xl bg-white rounded-3xl border border-border/50 shadow-lg overflow-hidden">
                <div className="p-6 bg-secondary/20 border-b border-border/50 flex justify-between items-center">
                  <div>
                    <h3 className="font-heading font-bold text-lg text-foreground">Migration Summary</h3>
                    <p className="text-sm text-muted-foreground">Estimated Phase 1</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${
                      plan.riskLevel === "Low Risk" ? "bg-green-50 text-green-700 ring-green-200" :
                      plan.riskLevel === "Medium Risk" ? "bg-yellow-50 text-yellow-700 ring-yellow-200" :
                      "bg-red-50 text-red-700 ring-red-200"
                    }`}>
                      {plan.riskLevel}
                    </span>
                  </div>
                </div>
                <div className="p-6 space-y-6">
                  <div className="flex justify-between items-center p-4 rounded-2xl bg-muted/50">
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground mb-1">Timeline Estimate</span>
                      <span className="font-heading font-bold text-xl" data-testid="text-timeline">{plan.timelineEstimate}</span>
                    </div>
                    <div className="w-px h-12 bg-border"></div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground mb-1">Downtime Needed</span>
                      <span className="font-heading font-bold text-xl" data-testid="text-downtime">{plan.downtimeEstimate}</span>
                    </div>
                    <div className="w-px h-12 bg-border"></div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground mb-1">Complexity</span>
                      <span className={`font-heading font-bold text-xl ${
                        plan.complexity === "Low" ? "text-green-600" :
                        plan.complexity === "Moderate" ? "text-yellow-600" : "text-red-600"
                      }`} data-testid="text-complexity">{plan.complexity}</span>
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
                  <Button className="flex-1 rounded-full h-12 text-base" data-testid="btn-start-over" onClick={handleStartOver}>
                    Start New Plan
                  </Button>
                  <Button variant="outline" className="flex-1 rounded-full h-12 text-base bg-white" data-testid="btn-view-history" onClick={() => setLocation("/history")}>
                    View Past Plans
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-6" data-testid="text-plan-id">Plan ID: {plan.id}</p>
            </div>
          )}

          {generateMutation.isError && (
            <div className="text-center py-12 text-red-600">
              <p className="font-semibold mb-2">Something went wrong generating your plan.</p>
              <Button variant="outline" onClick={() => generateMutation.reset()}>Try Again</Button>
            </div>
          )}

          {currentStep !== "result" && !generateMutation.isPending && (
            <div className="mt-auto pt-8 flex justify-between border-t border-border/40">
              <Button 
                variant="ghost" 
                size="lg" 
                onClick={handleBack}
                disabled={currentStep === "source"}
                className={`rounded-full px-6 ${currentStep === "source" ? "invisible" : ""}`}
                data-testid="btn-wizard-back"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              
              <Button 
                size="lg"
                onClick={handleNext}
                disabled={
                  (currentStep === "source" && !source) || 
                  (currentStep === "destination" && !destination) ||
                  (currentStep === "resources" && resources.length === 0)
                }
                className="rounded-full px-8 shadow-md"
                data-testid="btn-wizard-next"
              >
                {currentStep === "resources" ? "Generate Plan" : "Continue"}
                {currentStep !== "resources" && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      </main>

      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/40">
        © 2026 Cavaridge, LLC. All rights reserved.
      </footer>
    </div>
  );
}