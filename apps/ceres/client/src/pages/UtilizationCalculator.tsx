import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Info,
  Sun,
  Moon,
  Monitor,
  ShieldCheck,
} from "lucide-react";
import { useTheme } from "next-themes";
import { BRANDING } from "@shared/branding";
import { DuckyMascot } from "@/components/DuckyMascot";
import {
  calculateUtilization,
  getClinicalGroupings,
  type ClinicalGrouping,
  type FunctionalLevel,
  type ComorbidityAdjustment,
  type AdmissionSource,
  type TimingCategory,
  type UtilizationResult,
  type UtilizationSeverity,
} from "@/lib/calculators/utilization";

function SeverityIcon({ severity }: { severity: UtilizationSeverity }) {
  switch (severity) {
    case "normal":
      return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    case "elevated":
      return <AlertCircle className="w-5 h-5 text-amber-500" />;
    case "high":
      return <AlertTriangle className="w-5 h-5 text-orange-600" />;
    case "critical":
      return <XCircle className="w-5 h-5 text-red-600" />;
  }
}

function severityColor(severity: UtilizationSeverity): string {
  switch (severity) {
    case "normal":
      return "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400";
    case "elevated":
      return "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400";
    case "high":
      return "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400";
    case "critical":
      return "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400";
  }
}

function severityBadge(severity: UtilizationSeverity): string {
  switch (severity) {
    case "normal":
      return "Within Range";
    case "elevated":
      return "Elevated";
    case "high":
      return "Over-Utilized";
    case "critical":
      return "Critical";
  }
}

function UtilizationBar({ result }: { result: UtilizationResult }) {
  const { expectedVisitRange, actualVisits, lupaThreshold } = result;
  const max = Math.max(expectedVisitRange.high * 1.5, actualVisits * 1.2, 30);

  const lupaPercent = (lupaThreshold / max) * 100;
  const rangeLowPercent = (expectedVisitRange.low / max) * 100;
  const rangeHighPercent = (expectedVisitRange.high / max) * 100;
  const actualPercent = (actualVisits / max) * 100;

  return (
    <div className="space-y-2">
      <div className="relative h-10 bg-muted/40 rounded-lg border border-border/50 overflow-hidden">
        {/* LUPA zone */}
        <div
          className="absolute top-0 bottom-0 bg-red-500/15"
          style={{ left: 0, width: `${lupaPercent}%` }}
        />
        {/* Expected range */}
        <div
          className="absolute top-0 bottom-0 bg-green-500/15"
          style={{
            left: `${rangeLowPercent}%`,
            width: `${rangeHighPercent - rangeLowPercent}%`,
          }}
        />
        {/* Over-utilization zone */}
        <div
          className="absolute top-0 bottom-0 bg-orange-500/10"
          style={{
            left: `${rangeHighPercent}%`,
            right: 0,
          }}
        />
        {/* Actual visits marker */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-primary z-10 rounded-full"
          style={{ left: `${Math.min(actualPercent, 100)}%` }}
        />
        <div
          className="absolute top-1 z-20 text-[10px] font-bold text-primary-foreground bg-primary rounded px-1.5 py-0.5"
          style={{
            left: `${Math.min(actualPercent, 95)}%`,
            transform: "translateX(-50%)",
          }}
        >
          {actualVisits}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-500/15 border border-red-500/30" />
          <span>LUPA (&lt;{lupaThreshold})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500/15 border border-green-500/30" />
          <span>Expected ({expectedVisitRange.low}–{expectedVisitRange.high})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-orange-500/10 border border-orange-500/30" />
          <span>Over-utilized</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-3 bg-primary rounded-full" />
          <span>Actual</span>
        </div>
      </div>
    </div>
  );
}

export default function UtilizationCalculator() {
  const { theme, setTheme } = useTheme();
  const groupings = getClinicalGroupings();

  const [clinicalGrouping, setClinicalGrouping] = useState<ClinicalGrouping>("MMTA_Cardiac_Circulatory");
  const [functionalLevel, setFunctionalLevel] = useState<FunctionalLevel>("medium");
  const [comorbidity, setComorbidity] = useState<ComorbidityAdjustment>("none");
  const [admissionSource, setAdmissionSource] = useState<AdmissionSource>("community");
  const [timing, setTiming] = useState<TimingCategory>("early");
  const [period, setPeriod] = useState<1 | 2>(1);
  const [actualVisitsStr, setActualVisitsStr] = useState("");

  const actualVisits = parseInt(actualVisitsStr, 10);
  const hasValidInput = !isNaN(actualVisits) && actualVisits >= 0;

  const result: UtilizationResult | null = useMemo(() => {
    if (!hasValidInput) return null;
    return calculateUtilization({
      clinicalGrouping,
      functionalLevel,
      comorbidityAdjustment: comorbidity,
      admissionSource,
      timing,
      actualVisits,
      period,
    });
  }, [clinicalGrouping, functionalLevel, comorbidity, admissionSource, timing, actualVisits, period, hasValidInput]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back + header */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All Tools
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-3 rounded-xl text-primary">
              <BarChart3 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Over-Utilization Calculator
              </h1>
              <p className="text-muted-foreground mt-1">
                PDGM-based visit analysis against CMS thresholds
              </p>
            </div>
            <DuckyMascot state="idle" size="sm" className="ml-2" />
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              size="icon"
              className="rounded-full h-9 w-9"
              onClick={() => setTheme("light")}
              title="Light theme"
            >
              <Sun className="h-4 w-4" />
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              size="icon"
              className="rounded-full h-9 w-9"
              onClick={() => setTheme("dark")}
              title="Dark theme"
            >
              <Moon className="h-4 w-4" />
            </Button>
            <Button
              variant={theme === "system" ? "default" : "outline"}
              size="icon"
              className="rounded-full h-9 w-9"
              onClick={() => setTheme("system")}
              title="System theme"
            >
              <Monitor className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            PDGM CY 2026
          </Badge>
          <span className="text-xs text-muted-foreground">
            Patient-Driven Groupings Model thresholds
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input panel */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Patient Classification</CardTitle>
                <CardDescription>Select PDGM grouping parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Clinical Grouping</Label>
                  <Select
                    value={clinicalGrouping}
                    onValueChange={(v) => setClinicalGrouping(v as ClinicalGrouping)}
                  >
                    <SelectTrigger className="h-12 bg-muted/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {groupings.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Functional Level</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["low", "medium", "high"] as FunctionalLevel[]).map((level) => (
                      <Button
                        key={level}
                        variant={functionalLevel === level ? "default" : "outline"}
                        className="h-12 font-semibold capitalize"
                        onClick={() => setFunctionalLevel(level)}
                      >
                        {level}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Comorbidity Adjustment</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["none", "low", "high"] as ComorbidityAdjustment[]).map((level) => (
                      <Button
                        key={level}
                        variant={comorbidity === level ? "default" : "outline"}
                        className="h-12 font-semibold capitalize"
                        onClick={() => setComorbidity(level)}
                      >
                        {level === "none" ? "None" : level === "low" ? "Low" : "High"}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Admission Source</Label>
                    <Select
                      value={admissionSource}
                      onValueChange={(v) => setAdmissionSource(v as AdmissionSource)}
                    >
                      <SelectTrigger className="h-12 bg-muted/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="community">Community</SelectItem>
                        <SelectItem value="institutional">Institutional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Episode Timing</Label>
                    <Select
                      value={timing}
                      onValueChange={(v) => setTiming(v as TimingCategory)}
                    >
                      <SelectTrigger className="h-12 bg-muted/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="early">Early (Initial)</SelectItem>
                        <SelectItem value="late">Late (Recert)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">30-Day Period</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={period === 1 ? "default" : "outline"}
                        className="h-12 font-semibold"
                        onClick={() => setPeriod(1)}
                      >
                        Period 1
                      </Button>
                      <Button
                        variant={period === 2 ? "default" : "outline"}
                        className="h-12 font-semibold"
                        onClick={() => setPeriod(2)}
                      >
                        Period 2
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="actual-visits" className="text-sm font-semibold">
                      Actual Visits
                    </Label>
                    <Input
                      id="actual-visits"
                      type="number"
                      min="0"
                      max="60"
                      placeholder="e.g., 12"
                      value={actualVisitsStr}
                      onChange={(e) => setActualVisitsStr(e.target.value)}
                      className="h-12 bg-muted/30 font-mono text-lg"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results panel */}
          <div className="lg:col-span-7 space-y-6">
            {!hasValidInput ? (
              <Card className="border-none shadow-md">
                <CardContent className="py-16 text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                    Enter Visit Count
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Select patient classification and enter actual visit count to see utilization analysis.
                  </p>
                </CardContent>
              </Card>
            ) : result ? (
              <>
                {/* Overall assessment */}
                <Card className={`border shadow-md ${severityColor(result.severity)}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <SeverityIcon severity={result.severity} />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-xl font-bold">
                            {severityBadge(result.severity)}
                          </h3>
                          <Badge variant="outline" className="font-mono">
                            {result.actualVisits} visits / Period {result.period}
                          </Badge>
                        </div>
                        <p className="text-sm opacity-80">
                          {result.pdgmGroup} — {functionalLevel} functional level
                          {comorbidity !== "none" ? ` — ${comorbidity} comorbidity` : ""}
                        </p>
                        <div className="flex items-center gap-4 text-sm mt-2">
                          <span>
                            Expected range:{" "}
                            <strong>
                              {result.expectedVisitRange.low}–{result.expectedVisitRange.high}
                            </strong>
                          </span>
                          <span>
                            Utilization ratio:{" "}
                            <strong>{(result.utilizationRatio * 100).toFixed(0)}%</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Utilization bar */}
                <Card className="border-none shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg">Visit Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <UtilizationBar result={result} />
                  </CardContent>
                </Card>

                {/* Findings */}
                <Card className="border-none shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg">Findings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {result.findings.map((finding, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border p-4 ${severityColor(finding.severity)}`}
                      >
                        <div className="flex items-start gap-3">
                          <SeverityIcon severity={finding.severity} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
                                {finding.category}
                              </span>
                            </div>
                            <p className="text-sm font-medium">{finding.message}</p>
                            {finding.detail && (
                              <p className="text-xs mt-2 opacity-70 leading-relaxed">
                                {finding.detail}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 bg-muted/30 rounded-lg p-4 border border-border/50">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            This calculator provides estimated utilization ranges based on PDGM clinical groupings.
            Actual CMS case-mix weights and LUPA thresholds may vary by year and specific HIPPS code.
            Always consult current CMS guidance and your agency&apos;s compliance team for official thresholds.
          </p>
        </div>

        {/* Footer */}
        <footer className="text-center py-6 mt-8 border-t border-border space-y-2">
          <div className="flex items-center justify-center gap-2">
            <DuckyMascot state="idle" size="sm" />
            <span className="text-sm font-medium text-muted-foreground">
              {BRANDING.duckyFooter}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {BRANDING.parentCompany}. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}
