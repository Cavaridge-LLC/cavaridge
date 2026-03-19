import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import DuckyMascot from "@/components/DuckyMascot";
import RiskBadge from "@/components/RiskBadge";
import { ChevronLeft, ChevronRight, Save, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "setup", label: "Setup" },
  { id: "administrative", label: "Administrative" },
  { id: "physical", label: "Physical" },
  { id: "technical", label: "Technical" },
  { id: "review", label: "Review & Submit" },
];

const RISK_LEVELS = ["low", "medium", "high", "critical"];

function computeRiskLevel(l: number, i: number) {
  const s = l * i;
  if (s >= 16) return "critical";
  if (s >= 11) return "high";
  if (s >= 6) return "medium";
  return "low";
}

export default function AssessmentWizardPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [assessmentType, setAssessmentType] = useState("security_rule");
  const [framework, setFramework] = useState("hipaa_security");
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [controlUpdates, setControlUpdates] = useState<Record<string, any>>({});
  const [guidancePanel, setGuidancePanel] = useState<{ controlId: string; guidance: any } | null>(null);
  const [guidanceLoading, setGuidanceLoading] = useState(false);

  // Create assessment mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/assessments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: (data) => {
      setAssessmentId(data.assessment.id);
      setStep(1);
    },
  });

  // Load controls for assessment
  const { data: controlsData } = useQuery({
    queryKey: ["assessment-controls", assessmentId],
    queryFn: () => apiRequest(`/api/assessments/${assessmentId}/controls`),
    enabled: !!assessmentId,
  });

  const controls = controlsData?.controls || [];
  const adminControls = controls.filter((c: any) => c.category === "administrative");
  const physicalControls = controls.filter((c: any) => c.category === "physical");
  const technicalControls = controls.filter((c: any) => c.category === "technical");

  // Update control mutation
  const updateControlMutation = useMutation({
    mutationFn: ({ controlId, data }: { controlId: string; data: any }) =>
      apiRequest(`/api/assessments/${assessmentId}/controls/${controlId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-controls", assessmentId] });
    },
  });

  // Save control updates
  const saveControlUpdate = (controlId: string, field: string, value: any) => {
    setControlUpdates(prev => ({
      ...prev,
      [controlId]: { ...prev[controlId], [field]: value },
    }));
  };

  const flushUpdates = async () => {
    for (const [controlId, data] of Object.entries(controlUpdates)) {
      await updateControlMutation.mutateAsync({ controlId, data });
    }
    setControlUpdates({});
  };

  // Request AI guidance
  const requestGuidance = async (controlId: string) => {
    setGuidanceLoading(true);
    try {
      const result = await apiRequest(
        `/api/assessments/${assessmentId}/controls/${controlId}/guidance`,
        { method: "POST" },
      );
      setGuidancePanel({ controlId, guidance: result.guidance });
    } catch {
      setGuidancePanel({ controlId, guidance: { guidance: "Unable to load guidance at this time." } });
    }
    setGuidanceLoading(false);
  };

  // Submit assessment
  const submitMutation = useMutation({
    mutationFn: () => apiRequest(`/api/assessments/${assessmentId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "in_progress" }),
    }),
    onSuccess: () => {
      navigate(`/assessments/${assessmentId}`);
    },
  });

  const handleSetup = () => {
    if (!title) return;
    createMutation.mutate({ title, assessmentType, framework });
  };

  const handleNext = async () => {
    await flushUpdates();
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const handlePrev = () => {
    setStep(s => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    await flushUpdates();
    submitMutation.mutate();
  };

  const renderControlList = (categoryControls: any[]) => (
    <div className="space-y-4">
      {categoryControls.map((control: any) => {
        const updates = controlUpdates[control.id] || {};
        const currentState = updates.currentState || control.currentState;
        const likelihood = updates.likelihood || control.likelihood || 1;
        const impact = updates.impact || control.impact || 1;
        const riskLevel = computeRiskLevel(likelihood, impact);

        return (
          <div key={control.id} className="bg-card rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">{control.controlRef}</span>
                  {control.safeguardType === "implementation_specification" && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted">Spec</span>
                  )}
                </div>
                <p className="font-medium mt-1">{control.controlName}</p>
              </div>
              <button
                onClick={() => requestGuidance(control.id)}
                className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
              >
                <Sparkles className="h-3 w-3" />
                Ask Ducky
              </button>
            </div>

            {/* Current State */}
            <div className="flex gap-2">
              {(["not_implemented", "partial", "implemented"] as const).map(state => (
                <button
                  key={state}
                  onClick={() => saveControlUpdate(control.id, "currentState", state)}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-md border transition",
                    currentState === state
                      ? state === "implemented" ? "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300"
                        : state === "partial" ? "bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-300"
                        : "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300"
                      : "hover:bg-muted",
                  )}
                >
                  {state.replace("_", " ")}
                </button>
              ))}
            </div>

            {/* Risk scoring */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Likelihood (1-5)</label>
                <select
                  value={likelihood}
                  onChange={(e) => saveControlUpdate(control.id, "likelihood", parseInt(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 text-sm rounded-md border bg-background"
                >
                  {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Impact (1-5)</label>
                <select
                  value={impact}
                  onChange={(e) => saveControlUpdate(control.id, "impact", parseInt(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 text-sm rounded-md border bg-background"
                >
                  {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Risk</label>
                <div className="mt-1.5">
                  <RiskBadge level={riskLevel} />
                  <span className="text-xs text-muted-foreground ml-2">{likelihood * impact}/25</span>
                </div>
              </div>
            </div>

            {/* Finding detail */}
            <textarea
              placeholder="Finding detail / notes..."
              defaultValue={control.findingDetail || ""}
              onBlur={(e) => saveControlUpdate(control.id, "findingDetail", e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border bg-background resize-none h-16"
            />

            {/* Guidance panel */}
            {guidancePanel != null && guidancePanel.controlId === control.id && (
              <div className="bg-primary/5 rounded-md p-3 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <DuckyMascot state={guidanceLoading ? "thinking" : "idle"} size="sm" showMessage={false} />
                  <span className="text-sm font-medium text-primary">Ducky Intelligence</span>
                </div>
                <p className="text-sm">{guidancePanel.guidance.guidance}</p>
                {guidancePanel.guidance.recommendations && (
                  <ul className="mt-2 space-y-1">
                    {(guidancePanel.guidance.recommendations as string[]).map((r: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                        <span className="text-primary mt-0.5">-</span> {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">New Risk Assessment</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition",
              i < step ? "bg-primary border-primary text-primary-foreground"
                : i === step ? "border-primary text-primary"
                : "border-muted text-muted-foreground",
            )}>
              {i + 1}
            </div>
            <span className={cn(
              "text-xs ml-1.5 hidden sm:inline",
              i === step ? "text-foreground font-medium" : "text-muted-foreground",
            )}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-border mx-2" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 0 && (
        <div className="bg-card rounded-xl border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Assessment Setup</h2>

          <div>
            <label className="text-sm font-medium">Assessment Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Q1 2026 HIPAA Security Rule Assessment"
              className="w-full mt-1 px-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Assessment Type</label>
            <select
              value={assessmentType}
              onChange={(e) => setAssessmentType(e.target.value)}
              className="w-full mt-1 px-4 py-2 rounded-lg border bg-background"
            >
              <option value="security_rule">Security Rule</option>
              <option value="privacy_rule">Privacy Rule</option>
              <option value="breach_notification">Breach Notification</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Framework</label>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              className="w-full mt-1 px-4 py-2 rounded-lg border bg-background"
            >
              <option value="hipaa_security">HIPAA Security Rule</option>
              <option value="hipaa_privacy">HIPAA Privacy Rule</option>
              <option value="hitrust">HITRUST CSF</option>
            </select>
          </div>

          <button
            onClick={handleSetup}
            disabled={!title || createMutation.isPending}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition"
          >
            {createMutation.isPending ? "Creating..." : "Create & Begin"}
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Administrative Safeguards (45 CFR 164.308)</h2>
          <p className="text-sm text-muted-foreground">Evaluate your organization's administrative controls for ePHI protection.</p>
          {renderControlList(adminControls)}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Physical Safeguards (45 CFR 164.310)</h2>
          <p className="text-sm text-muted-foreground">Evaluate physical access controls and device/media security.</p>
          {renderControlList(physicalControls)}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Technical Safeguards (45 CFR 164.312)</h2>
          <p className="text-sm text-muted-foreground">Evaluate technical controls including access control, audit, integrity, and transmission security.</p>
          {renderControlList(technicalControls)}
        </div>
      )}

      {step === 4 && (
        <div className="bg-card rounded-xl border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Review & Submit</h2>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{controls.length}</p>
              <p className="text-sm text-muted-foreground">Total Controls</p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                {controls.filter((c: any) => (controlUpdates[c.id]?.currentState || c.currentState) === "implemented").length}
              </p>
              <p className="text-sm text-muted-foreground">Implemented</p>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                {controls.filter((c: any) => (controlUpdates[c.id]?.currentState || c.currentState) === "not_implemented").length}
              </p>
              <p className="text-sm text-muted-foreground">Not Implemented</p>
            </div>
          </div>

          <DuckyMascot state="assessing" />

          <button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <Send className="h-4 w-4" />
            {submitMutation.isPending ? "Submitting..." : "Submit Assessment"}
          </button>
        </div>
      )}

      {/* Navigation */}
      {step > 0 && (
        <div className="flex justify-between">
          <button
            onClick={handlePrev}
            className="flex items-center gap-1 px-4 py-2 border rounded-lg hover:bg-muted transition"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          {step < STEPS.length - 1 && (
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
