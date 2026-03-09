import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Download,
  ChevronDown,
  FileSpreadsheet,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  BarChart3,
  X,
} from "lucide-react";
import type { Deal } from "@shared/schema";

interface ReportType {
  id: string;
  title: string;
  format: string;
  icon: typeof FileText;
  iconColor: string;
  description: string;
  sections: string[];
  endpoint: (dealId: string) => string;
  streamEndpoint?: (dealId: string) => string;
}

const reportTypes: ReportType[] = [
  {
    id: "docx",
    title: "Intelligence Report",
    format: "DOCX",
    icon: FileText,
    iconColor: "#3B82F6",
    description: "Full IC-grade due diligence report in Word format with AI-powered finding consolidation, executive narrative, structured tables, and complete evidence analysis — ready for editing and investment committee presentations.",
    sections: [
      "Cover page with organization name and confidentiality notice",
      "Auto-generated Table of Contents",
      "AI-generated executive summary with investment verdict and risk assessment",
      "Risk score overview with pillar breakdown table",
      "Pillar assessments with AI-written narratives, strengths, and concerns",
      "Consolidated findings register grouped by risk theme (AI-powered)",
      "Technology stack inventory grouped by category with EOL highlighting",
      "Baseline alignment with gap severity and remediation cost estimates",
      "Integration roadmap with phase tables and task details",
      "Network topology nodes and connections inventory",
      "Infrastructure summary (Network, Applications, Security Controls)",
      "Cost estimates (CapEx findings + OpEx baseline gaps)",
      "Follow-up items with priority, timeline, and owner",
      "Deal risks and positive observations",
      "Recommendations and next steps",
      "Appendices: Full findings, document inventory, methodology & glossary",
    ],
    endpoint: (dealId) => `/api/deals/${dealId}/export/docx`,
    streamEndpoint: (dealId) => `/api/deals/${dealId}/export/docx-stream`,
  },
  {
    id: "executive-docx",
    title: "Executive Summary",
    format: "DOCX",
    icon: ShieldAlert,
    iconColor: "#8B5CF6",
    description: "Condensed executive briefing in Word format with AI-generated investment verdict, key risk findings, pillar score overview, and conditions before close — designed for senior leadership review.",
    sections: [
      "Cover page with deal overview and assessment date",
      "AI investment verdict with composite score",
      "Target profile and key risk findings (5-7 bullets)",
      "Top 3 conditions before close",
      "Pillar score table with confidence levels",
      "Key metrics summary (findings, documents, tech items)",
    ],
    endpoint: (dealId) => `/api/deals/${dealId}/export/executive-docx`,
    streamEndpoint: (dealId) => `/api/deals/${dealId}/export/executive-docx-stream`,
  },
  {
    id: "csv",
    title: "Data Export",
    format: "CSV",
    icon: FileSpreadsheet,
    iconColor: "#10B981",
    description: "Complete structured data export of all deal intelligence for spreadsheets, custom analysis, or integration with external tools and reporting systems.",
    sections: [
      "Deal metadata with scoring, confidence, and facility details",
      "Risk pillar scores with confidence levels, weights, and caps",
      "All findings with full descriptions, impact estimates, and remediation notes",
      "Technology stack inventory with versions, status, and confidence",
      "Baseline comparisons with gap severity and estimated remediation costs",
      "Integration playbook phases and tasks with critical path flags",
      "Document inventory with classification, size, and extraction status",
      "Network topology nodes and connections",
    ],
    endpoint: (dealId) => `/api/deals/${dealId}/export/csv`,
  },
  {
    id: "excel",
    title: "Excel Data Export",
    format: "XLSX",
    icon: BarChart3,
    iconColor: "#06B6D4",
    description: "Filterable findings, cost estimates, and document inventory in Excel format for IC analysis.",
    sections: [
      "Executive summary with composite scores and letter grades",
      "Complete findings register with severity auto-filters",
      "Cost estimates with CapEx, OpEx, and 3-year TCO breakdown",
      "Document inventory with classification and confidence details",
      "Pillar-by-pillar detail with findings and supporting evidence",
    ],
    endpoint: (dealId: string) => `/api/deals/${dealId}/export/excel`,
  },
];

interface ProgressState {
  step: number;
  total: number;
  label: string;
}

interface CompletedReport {
  jobId: string;
  filename: string;
  fileSize: number;
  downloadUrl: string;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function ReportsPage() {
  const { toast } = useToast();
  const { data: dealsList = [], isLoading: dealsLoading } = useQuery<Deal[]>({ queryKey: ["/api/deals"] });
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [completedReport, setCompletedReport] = useState<CompletedReport | null>(null);
  const [generatingTitle, setGeneratingTitle] = useState<string>("");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeDeal = dealsList.find((d) => d.id === selectedDealId) || dealsList[0];
  const dealId = activeDeal?.id;

  const downloadFromUrl = useCallback(async (url: string, filename: string) => {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }, []);

  const handleDownload = async (report: ReportType) => {
    if (!dealId) return;

    if (report.streamEndpoint) {
      setDownloading(report.id);
      setProgress({ step: 0, total: 1, label: "Starting..." });
      setCompletedReport(null);
      setGeneratingTitle(report.title);
      setGenerationError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const url = report.streamEndpoint(dealId);
        const csrfMatch = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
        const csrfHeaders: Record<string, string> = csrfMatch
          ? { "X-XSRF-TOKEN": decodeURIComponent(csrfMatch[1]) }
          : {};
        const response = await fetch(url, {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
          headers: csrfHeaders,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ message: "Generation failed" }));
          throw new Error(err.message);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Streaming not supported");

        const decoder = new TextDecoder();
        let buffer = "";

        const processLine = (line: string) => {
          const prefix = line.startsWith("data: ") ? 6 : line.startsWith("data:") ? 5 : -1;
          if (prefix === -1) return;
          try {
            const data = JSON.parse(line.slice(prefix));
            if (data.type === "progress") {
              setProgress({ step: data.step, total: data.total, label: data.label });
            } else if (data.type === "complete") {
              setProgress(null);
              setCompletedReport(data.report);
            } else if (data.type === "error") {
              throw new Error(data.message);
            }
          } catch (e: any) {
            if (e.message && !e.message.includes("JSON")) throw e;
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            processLine(line);
          }
        }

        if (buffer.trim()) {
          processLine(buffer.trim());
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          setGenerationError(error.message);
          setProgress(null);
          toast({ title: "Generation failed", description: error.message, variant: "destructive" });
        }
      } finally {
        abortRef.current = null;
      }
    } else {
      setDownloading(report.id);
      try {
        const url = report.endpoint(dealId);
        const isPost = report.id === "excel";
        const response = await fetch(url, { method: isPost ? "POST" : "GET", credentials: "include" });
        if (!response.ok) {
          const err = await response.json().catch(() => ({ message: "Download failed" }));
          throw new Error(err.message);
        }
        const blob = await response.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const ext = report.format.toLowerCase();
        a.download = `MERIDIAN_${(activeDeal?.targetName || "deal").replace(/[^a-zA-Z0-9]/g, "_")}_Report.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        toast({ title: "Report downloaded", description: `${report.title} (${report.format}) has been saved.` });
      } catch (error: any) {
        toast({ title: "Download failed", description: error.message, variant: "destructive" });
      } finally {
        setDownloading(null);
      }
    }
  };

  const closeProgressModal = () => {
    setProgress(null);
    setCompletedReport(null);
    setGeneratingTitle("");
    setGenerationError(null);
    setDownloading(null);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  const showModal = progress !== null || completedReport !== null || generationError !== null;

  if (dealsLoading) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="space-y-4">
          <div className="h-6 w-32 bg-[var(--bg-panel)] rounded animate-pulse" />
          <div className="h-4 w-64 bg-[var(--bg-panel)] rounded animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
            <div className="h-64 bg-[var(--bg-panel)] rounded-lg animate-pulse" />
            <div className="h-64 bg-[var(--bg-panel)] rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (dealsList.length === 0) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-2" data-testid="text-reports-title">Reports</h1>
        <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-8 text-center">
          <FileText className="w-10 h-10 text-[var(--text-disabled)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">No deals available to generate reports from.</p>
          <p className="text-xs text-[var(--text-disabled)] mt-1">Create a deal in Pipeline to get started.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto animate-fade-in">
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="modal-progress">
          <Card className="bg-[var(--bg-card)] border-[var(--theme-border)] w-full max-w-md mx-4 p-6 relative">
            <button
              onClick={closeProgressModal}
              className="absolute top-3 right-3 text-[var(--text-disabled)] hover:text-[var(--text-primary)]"
              data-testid="button-close-progress"
            >
              <X className="w-4 h-4" />
            </button>

            {generationError ? (
              <div className="text-center py-4" data-testid="progress-error">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                  <X className="w-6 h-6 text-red-500" />
                </div>
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Generation Failed</p>
                <p className="text-xs text-[var(--text-secondary)] mb-4">{generationError}</p>
                <Button size="sm" variant="outline" onClick={closeProgressModal} data-testid="button-dismiss-error">
                  Dismiss
                </Button>
              </div>
            ) : completedReport ? (
              <div className="text-center py-4" data-testid="progress-complete">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Report Generated</p>
                <p className="text-xs text-[var(--text-secondary)] mb-4">
                  {completedReport.filename} — {formatFileSize(completedReport.fileSize)}
                </p>
                <div className="flex gap-3 justify-center">
                  <Button
                    size="sm"
                    className="gap-2"
                    style={{ backgroundColor: "#3B82F6" }}
                    onClick={async () => {
                      try {
                        await downloadFromUrl(completedReport.downloadUrl, completedReport.filename);
                        toast({ title: "Report downloaded", description: `${completedReport.filename} has been saved.` });
                        closeProgressModal();
                      } catch {
                        toast({ title: "Download failed", variant: "destructive" });
                      }
                    }}
                    data-testid="button-download-complete"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </Button>
                  <Button size="sm" variant="outline" onClick={closeProgressModal} data-testid="button-close-complete">
                    Close
                  </Button>
                </div>
              </div>
            ) : progress ? (
              <div className="text-center py-4" data-testid="progress-generating">
                <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6] mx-auto mb-3" />
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  Generating {generatingTitle}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mb-4">{progress.label}</p>
                <div className="w-full bg-[var(--bg-panel)] h-2 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-[#3B82F6] rounded-full transition-all duration-300"
                    style={{ width: `${(progress.step / progress.total) * 100}%` }}
                    data-testid="progress-bar"
                  />
                </div>
                <p className="text-[10px] text-[var(--text-disabled)]">
                  Step {progress.step} of {progress.total} — This typically takes 30-60 seconds
                </p>
              </div>
            ) : null}
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-[var(--text-primary)]" data-testid="text-reports-title">Reports</h1>
            <Badge
              variant="outline"
              className="text-[10px] font-data border-[#3B82F6]/30 text-[#3B82F6] no-default-hover-elevate no-default-active-elevate"
            >
              Export
            </Badge>
          </div>
          <p className="text-xs text-[var(--text-disabled)] mt-0.5">
            Generate and download deal intelligence reports
          </p>
        </div>

        <div className="relative">
          <select
            value={dealId || ""}
            onChange={(e) => setSelectedDealId(e.target.value)}
            className="appearance-none bg-[var(--bg-card)] border border-[var(--theme-border)] rounded-md px-3 py-1.5 pr-8 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#3B82F6]/50"
            data-testid="select-deal"
          >
            {dealsList.map((d) => (
              <option key={d.id} value={d.id}>{d.targetName}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-disabled)] pointer-events-none" />
        </div>
      </div>

      {activeDeal && (
        <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-4" data-testid="card-deal-summary">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md flex items-center justify-center bg-[#3B82F6]/10">
                <ShieldAlert className="w-4 h-4 text-[#3B82F6]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{activeDeal.targetName}</p>
                <p className="text-[10px] text-[var(--text-disabled)]">{activeDeal.industry} | {activeDeal.stage || activeDeal.status}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 ml-auto text-xs">
              {activeDeal.compositeScore && (
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-[var(--text-disabled)]" />
                  <span className="text-[var(--text-disabled)]">Score:</span>
                  <span className="font-data font-bold text-[var(--text-primary)]">{Number(activeDeal.compositeScore).toFixed(0)}</span>
                </div>
              )}
              {activeDeal.overallConfidence && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--text-disabled)]" />
                  <span className="text-[var(--text-disabled)]">Confidence:</span>
                  <span className="font-data font-medium text-[var(--text-primary)]">{activeDeal.overallConfidence}</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {reportTypes.map((report) => {
          const Icon = report.icon;
          const isDownloading = downloading === report.id;
          return (
            <Card
              key={report.id}
              className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-5 flex flex-col"
              data-testid={`card-report-${report.id}`}
            >
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${report.iconColor}15` }}
                >
                  <Icon className="w-5 h-5" style={{ color: report.iconColor }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">{report.title}</h3>
                    <Badge
                      className="text-[9px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate border"
                      style={{
                        backgroundColor: `${report.iconColor}12`,
                        color: report.iconColor,
                        borderColor: `${report.iconColor}30`,
                      }}
                    >
                      {report.format}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {report.description}
                  </p>
                </div>
              </div>

              <div className="bg-[var(--bg-panel)] rounded-md p-3 mb-4 flex-1">
                <h4 className="text-[10px] uppercase tracking-wider text-[var(--text-disabled)] font-medium mb-2">Includes</h4>
                <ul className="space-y-1.5">
                  {report.sections.map((section, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                      <CheckCircle2 className="w-3 h-3 text-[#10B981] mt-0.5 shrink-0" />
                      <span>{section}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                onClick={() => handleDownload(report)}
                disabled={isDownloading || !dealId}
                size="sm"
                className="w-full text-xs gap-2"
                style={{
                  backgroundColor: isDownloading ? undefined : report.iconColor,
                }}
                data-testid={`button-download-${report.id}`}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Download {report.title}
                  </>
                )}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
