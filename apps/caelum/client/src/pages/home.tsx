import { useState, useRef, useEffect, useCallback } from "react";
import { BRANDING } from "@shared/branding";
import { DuckyMascot } from "@/components/DuckyMascot";
import type { DuckyState } from "@/components/DuckyMascot";
import {
  FileText,
  Building2,
  CheckCircle2,
  AlertCircle,
  Copy,
  LogOut,
  Send,
  Plus,
  Bot,
  User,
  ChevronRight,
  ShieldAlert,
  TriangleAlert,
  Paperclip,
  X,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  MessageSquare,
  Loader2,
  History,
  RotateCcw,
  Eye,
  Clock,
  Pencil,
  Save,
  Download,
  Network,
  Monitor,
  Server,
  Undo2,
  Redo2,
  ArrowLeftRight,
  ClipboardCheck,
  Search,
  Moon,
  Sun,
  BarChart3,
  Zap,
  Brain,
  Sparkles,
  ChevronDown,
  Star,
  GitBranch,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  SpellCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { fetchCsrfToken, getCsrfToken } from "@/lib/queryClient";

interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
}

interface ConversationSummary {
  id: number;
  title: string;
  sowJson: any;
  flagged: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UploadedFile {
  name: string;
  content: string;
  size: number;
}

function parseSow(text: string): any | null {
  const startMarker = "<<<SOW_START>>>";
  const endMarker = "<<<SOW_END>>>";
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return null;
  const jsonStr = text.substring(startIdx + startMarker.length, endIdx).trim();
  try {
    const parsed = JSON.parse(jsonStr);
    // Detect v2.1 vs v2.0 format
    const caveats = parsed.caveats_and_risks || parsed.caveatsAndRisks;
    const pm = parsed.project_management || parsed.projectManagement;
    const isV21 = !!parsed.labor_hours || !!parsed.proposed_solution;

    // v2.1: prerequisites is a flat array; v2.0: object with sub-arrays
    const prereqs = Array.isArray(parsed.prerequisites)
      ? { flat: parsed.prerequisites, clientResponsibilities: [], vendorResponsibilities: [], thirdPartyResponsibilities: [] }
      : {
          flat: [],
          clientResponsibilities: parsed.prerequisites?.clientResponsibilities || [],
          vendorResponsibilities: parsed.prerequisites?.vendorResponsibilities || [],
          thirdPartyResponsibilities: parsed.prerequisites?.thirdPartyResponsibilities || [],
        };

    // v2.1 labor_hours → unified shape; v2.0 workloadEstimate → legacy shape
    const laborRows = parsed.labor_hours?.rows || [];
    const hasV21Labor = laborRows.length > 0;

    return {
      title: parsed.title || "",
      subtitle: parsed.subtitle || "",
      scopeType: parsed.scopeType || parsed.scope_type || "",
      summary: parsed.summary || "",
      solution: parsed.proposed_solution?.overview || parsed.solution || "",
      proposedSolution: parsed.proposed_solution || null,
      accessPrerequisites: parsed.accessPrerequisites || [],
      responsibilityMatrix: (parsed.responsibilityMatrix || []).map((r: any) => ({
        area: r.area || "",
        client: r.client || "",
        dit: r.dit || "",
      })),
      prerequisites: prereqs,
      dependencies: parsed.dependencies || [],
      projectManagement: {
        siteAddress: pm?.siteAddress || pm?.site_address || "",
        pocs: pm?.pocs || [],
        contacts: pm?.contacts || [],
        siteInfo: pm?.siteInfo || pm?.site_info || null,
        tasks: pm?.tasks || pm?.pm_tasks || [],
      },
      outline: (parsed.outline || []).map((p: any) => ({
        phase: p.phase || "",
        objective: p.objective || "",
        tasks: p.tasks || [],
        deliverables: p.deliverables || [],
      })),
      caveatsAndRisks: {
        assumptions: caveats?.assumptions || [],
        exclusions: caveats?.exclusions || [],
        risks: (caveats?.risks || []).map((r: any) => ({
          risk: r.risk || "",
          impact: r.impact || "",
          mitigation: r.mitigation || "",
          // Legacy v2.0 fields
          likelihood: r.likelihood || "",
          mitigationDIT: r.mitigationDIT || "",
          mitigationClient: r.mitigationClient || "",
          decision: r.decision || "",
        })),
        changeControl: caveats?.change_control || caveats?.changeControl || parsed.changeControl || "",
      },
      changeControl: caveats?.change_control || caveats?.changeControl || parsed.changeControl || "",
      completionCriteria: parsed.completionCriteria || parsed.completion_criteria || [],
      approval: parsed.approval || "",
      outOfScope: parsed.outOfScope || caveats?.exclusions || [],
      // v2.1 labor hours (Role | Scope | Hours Range — no pricing)
      laborHours: hasV21Labor ? {
        rows: laborRows.map((r: any) => ({
          role: r.role || "",
          scope: r.scope || "",
          hoursRange: r.hours_range || r.hoursRange || "",
        })),
        totalHoursRange: parsed.labor_hours?.total_hours_range || parsed.labor_hours?.totalHoursRange || "",
        notes: parsed.labor_hours?.notes || [],
      } : null,
      // Legacy v2.0 workload estimate (with pricing)
      workloadEstimate: !hasV21Labor ? {
        lineItems: (parsed.workloadEstimate?.lineItems || []).map((li: any) => ({
          role: li.role || "",
          rate: Number(li.rate) || 0,
          hours: Number(li.hours) || 0,
          description: li.description || "",
        })),
        notes: parsed.workloadEstimate?.notes || null,
      } : null,
    };
  } catch {
    return null;
  }
}

function stripSowMarkers(text: string): string {
  const startMarker = "<<<SOW_START>>>";
  const endMarker = "<<<SOW_END>>>";
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return text;
  const before = text.substring(0, startIdx).trim();
  const after = text.substring(endIdx + endMarker.length).trim();
  return [before, after].filter(Boolean).join("\n\n");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-all ${
        copied
          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
          : "bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 border border-slate-200"
      }`}
      data-testid="btn-copy-message"
    >
      {copied ? (
        <><ClipboardCheck className="w-3 h-3" /> Copied</>
      ) : (
        <><Copy className="w-3 h-3" /> Copy</>
      )}
    </button>
  );
}

function buildPlainText(sow: any): string {
  let t = "";
  if (sow.title) t += sow.title.toUpperCase() + "\n";
  if (sow.subtitle) t += sow.subtitle + "\n";
  t += "\nSCOPE OF WORK\n\n";

  t += "1. SUMMARY\n" + sow.summary + "\n\n";
  t += "2. PROPOSED SOLUTION\n" + sow.solution + "\n\n";

  t += "3. PREREQUISITES\n";
  if (sow.accessPrerequisites?.length) {
    t += "\nAccess and Readiness:\n" + sow.accessPrerequisites.map((s: string) => "• " + s).join("\n") + "\n";
  }
  if (sow.responsibilityMatrix?.length) {
    t += "\nResponsibilities:\n";
    for (const row of sow.responsibilityMatrix) {
      t += `  ${row.area}: Client — ${row.client} | ${BRANDING.vendorAbbreviation} — ${row.dit}\n`;
    }
  }
  if (sow.prerequisites?.clientResponsibilities?.length) {
    t += "\nClient Responsibilities:\n" + sow.prerequisites.clientResponsibilities.map((s: string) => "• " + s).join("\n") + "\n";
  }
  if (sow.prerequisites?.vendorResponsibilities?.length) {
    t += `\nVendor Responsibilities (${BRANDING.vendorName}):\n` + sow.prerequisites.vendorResponsibilities.map((s: string) => "• " + s).join("\n") + "\n";
  }
  if (sow.prerequisites?.thirdPartyResponsibilities?.length) {
    t += "\nThird-Party Responsibilities:\n" + sow.prerequisites.thirdPartyResponsibilities.map((s: string) => "• " + s).join("\n") + "\n";
  }
  t += "\n";

  if (sow.dependencies?.length) {
    t += "4. DEPENDENCIES\n" + sow.dependencies.map((d: string) => "• " + d).join("\n") + "\n\n";
  } else {
    t += "4. DEPENDENCIES\nNone specified.\n\n";
  }

  t += "5. PROJECT MANAGEMENT\n";
  if (sow.projectManagement?.siteAddress) t += "Site Address: " + sow.projectManagement.siteAddress + "\n";
  if (sow.projectManagement?.pocs?.length) t += "POCs: " + sow.projectManagement.pocs.join("; ") + "\n";
  if (sow.projectManagement?.siteInfo) t += "Site/Connectivity Info: " + sow.projectManagement.siteInfo + "\n";
  if (sow.projectManagement?.tasks?.length) {
    t += "\nProject Management Tasks:\n" + sow.projectManagement.tasks.map((s: string) => "• " + s).join("\n") + "\n\n";
  }

  t += "6. HIGH-LEVEL PROJECT OUTLINE\n";
  (sow.outline || []).forEach((p: any) => {
    t += "\n" + p.phase + "\n";
    t += "Objective: " + p.objective + "\n";
    t += "Tasks:\n" + (p.tasks || []).map((s: string) => "  • " + s).join("\n") + "\n";
    t += "Deliverables:\n" + (p.deliverables || []).map((s: string) => "  • " + s).join("\n") + "\n";
  });
  t += "\n";

  t += "7. CAVEATS / RISKS\n";
  if (sow.caveatsAndRisks?.assumptions?.length) {
    t += "\nAssumptions:\n" + sow.caveatsAndRisks.assumptions.map((s: string) => "• " + s).join("\n") + "\n";
  }
  if (sow.caveatsAndRisks?.risks?.length) {
    t += "\nRisks:\n";
    sow.caveatsAndRisks.risks.forEach((r: any) => {
      t += "\nRisk: " + r.risk + "\n";
      t += "Impact: " + r.impact + "\n";
      t += "Likelihood: " + r.likelihood + "\n";
      t += `Mitigation (${BRANDING.vendorAbbreviation}): ` + r.mitigationDIT + "\n";
      t += "Mitigation (Client): " + r.mitigationClient + "\n";
      t += "Decision/Dependency: " + r.decision + "\n";
    });
  }
  t += "\n";

  if (sow.changeControl) t += "8. CHANGE CONTROL\n" + sow.changeControl + "\n\n";

  if (sow.completionCriteria?.length) {
    t += "9. ACCEPTANCE CRITERIA\n" + sow.completionCriteria.map((s: string) => "• " + s).join("\n") + "\n\n";
  }

  if (sow.approval) {
    t += "APPROVAL\n" + (typeof sow.approval === "string" ? sow.approval : "") + "\n\n";
  }

  // v2.1 labor hours (no pricing)
  if (sow.laborHours?.rows?.length) {
    t += "ESTIMATED LABOR HOURS\n";
    t += "Role                       | Scope of Involvement                    | Est. Hours\n";
    t += "---------------------------|----------------------------------------|----------\n";
    sow.laborHours.rows.forEach((row: any) => {
      t += `${(row.role || "").padEnd(27)}| ${(row.scope || "").padEnd(40)}| ${row.hoursRange || ""}\n`;
    });
    if (sow.laborHours.totalHoursRange) {
      t += `${"TOTAL".padEnd(27)}| ${"".padEnd(40)}| ${sow.laborHours.totalHoursRange}\n`;
    }
    if (sow.laborHours.notes?.length) {
      t += "\nNotes:\n" + sow.laborHours.notes.map((n: string) => "• " + n).join("\n") + "\n";
    }
    t += "\n";
  }
  // Legacy v2.0 workload estimate fallback
  else if (sow.workloadEstimate?.lineItems?.length) {
    t += "WORKLOAD ESTIMATE\n";
    t += "Role                       | Rate     | Hours | Subtotal   | Description\n";
    t += "---------------------------|----------|-------|------------|---------------------------\n";
    let totalHours = 0, totalCost = 0;
    sow.workloadEstimate.lineItems.forEach((li: any) => {
      const sub = li.rate * li.hours;
      totalHours += li.hours;
      totalCost += sub;
      t += `${li.role.padEnd(27)}| $${li.rate.toString().padEnd(7)}| ${li.hours.toString().padEnd(5)} | $${sub.toLocaleString().padEnd(10)}| ${li.description}\n`;
    });
    t += `${"TOTAL".padEnd(27)}|          | ${totalHours.toString().padEnd(5)} | $${totalCost.toLocaleString()}\n`;
    if (sow.workloadEstimate.notes) t += "\nNotes: " + sow.workloadEstimate.notes + "\n";
    t += "\n";
  }

  return t;
}

const SOW_TEMPLATES = [
  { name: "Network Deployment", icon: Network, description: "New network builds, switch/AP/firewall deployments, site cutovers", starter: "I'm starting a Network Deployment scope. This project involves network infrastructure — switches, APs, firewalls, and/or site cutovers. Let me share the details..." },
  { name: "Onboarding & Stabilization", icon: CheckCircle2, description: "New client onboarding, managed services activation", starter: "I'm starting an Onboarding & Stabilization scope. This is a new client onboarding covering managed services activation. Let me share the details..." },
  { name: "Endpoint Deployment", icon: Monitor, description: "Device rollouts, imaging, enrollment, user training", starter: "I'm starting an Endpoint Deployment scope. This project involves device rollouts, imaging, and enrollment. Let me share the details..." },
  { name: "Server Virtualization & Recovery", icon: Server, description: "VM migrations, disaster recovery, infrastructure rebuild", starter: "I'm starting a Server Virtualization & Recovery scope. This project involves VM migrations or disaster recovery. Let me share the details..." },
  { name: "Custom / Other", icon: Plus, description: "General purpose SoW for any project type", starter: "" },
];

function VersionDiff({ oldSow, newSow, oldLabel, newLabel }: { oldSow: any; newSow: any; oldLabel: string; newLabel: string }) {
  const textChanged = (a: any, b: any) => String(a ?? "") !== String(b ?? "");
  const arraysChanged = (a: any[], b: any[]) => {
    const aa = a || [], bb = b || [];
    if (aa.length !== bb.length) return true;
    return aa.some((v: any, i: number) => String(v) !== String(bb[i]));
  };

  const DiffField = ({ label, oldVal, newVal }: { label: string; oldVal: any; newVal: any }) => {
    const changed = textChanged(oldVal, newVal);
    return (
      <div className={`rounded-md p-3 ${changed ? "bg-amber-50 border border-amber-200" : "bg-white border border-slate-100"}`} data-testid={`diff-field-${label}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-slate-600">{label}</span>
          {changed && <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Changed</span>}
        </div>
        {changed ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">{oldLabel}</span>
              <p className="text-sm text-red-700 bg-red-50 rounded p-2 whitespace-pre-wrap line-through decoration-red-300">{String(oldVal ?? "—")}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">{newLabel}</span>
              <p className="text-sm text-green-700 bg-green-50 rounded p-2 whitespace-pre-wrap">{String(newVal ?? "—")}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{String(oldVal ?? "—")}</p>
        )}
      </div>
    );
  };

  const DiffList = ({ label, oldItems, newItems }: { label: string; oldItems: string[]; newItems: string[] }) => {
    const oi = oldItems || [], ni = newItems || [];
    const changed = arraysChanged(oi, ni);
    return (
      <div className={`rounded-md p-3 ${changed ? "bg-amber-50 border border-amber-200" : "bg-white border border-slate-100"}`} data-testid={`diff-list-${label}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-slate-600">{label}</span>
          {changed && <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Changed</span>}
        </div>
        {changed ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">{oldLabel}</span>
              <ul className="space-y-1">
                {oi.map((item, i) => {
                  const inNew = ni.includes(item);
                  return <li key={i} className={`text-sm flex gap-1.5 ${inNew ? "text-slate-600" : "text-red-600 bg-red-50 rounded px-1.5 py-0.5 line-through"}`}><span className="shrink-0">•</span>{item}</li>;
                })}
              </ul>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">{newLabel}</span>
              <ul className="space-y-1">
                {ni.map((item, i) => {
                  const inOld = oi.includes(item);
                  return <li key={i} className={`text-sm flex gap-1.5 ${inOld ? "text-slate-600" : "text-green-600 bg-green-50 rounded px-1.5 py-0.5 font-medium"}`}><span className="shrink-0">•</span>{item}</li>;
                })}
              </ul>
            </div>
          </div>
        ) : (
          <ul className="space-y-1">{oi.map((item, i) => <li key={i} className="text-sm text-slate-600 flex gap-1.5"><span className="shrink-0">•</span>{item}</li>)}</ul>
        )}
      </div>
    );
  };

  const oldOutline = oldSow?.outline || [];
  const newOutline = newSow?.outline || [];
  const maxPhases = Math.max(oldOutline.length, newOutline.length);

  const oldRisks = oldSow?.caveatsAndRisks?.risks || [];
  const newRisks = newSow?.caveatsAndRisks?.risks || [];
  const maxRisks = Math.max(oldRisks.length, newRisks.length);

  const sections = [
    { label: "Title", oV: oldSow?.title, nV: newSow?.title },
    { label: "Subtitle", oV: oldSow?.subtitle, nV: newSow?.subtitle },
    { label: "Scope Type", oV: oldSow?.scopeType, nV: newSow?.scopeType },
    { label: "Summary", oV: oldSow?.summary, nV: newSow?.summary },
    { label: "Solution", oV: oldSow?.solution, nV: newSow?.solution },
    { label: "Change Control", oV: oldSow?.changeControl, nV: newSow?.changeControl },
    { label: "Approval", oV: oldSow?.approval, nV: newSow?.approval },
    { label: "Site Address", oV: oldSow?.projectManagement?.siteAddress, nV: newSow?.projectManagement?.siteAddress },
    { label: "Site Info", oV: oldSow?.projectManagement?.siteInfo, nV: newSow?.projectManagement?.siteInfo },
  ];

  const listSections = [
    { label: "Client Responsibilities", oI: oldSow?.prerequisites?.clientResponsibilities, nI: newSow?.prerequisites?.clientResponsibilities },
    { label: "Vendor Responsibilities", oI: oldSow?.prerequisites?.vendorResponsibilities, nI: newSow?.prerequisites?.vendorResponsibilities },
    { label: "3rd Party Responsibilities", oI: oldSow?.prerequisites?.thirdPartyResponsibilities, nI: newSow?.prerequisites?.thirdPartyResponsibilities },
    { label: "Dependencies", oI: oldSow?.dependencies, nI: newSow?.dependencies },
    { label: "Completion Criteria", oI: oldSow?.completionCriteria, nI: newSow?.completionCriteria },
    { label: "Out of Scope", oI: oldSow?.outOfScope, nI: newSow?.outOfScope },
    { label: "Assumptions", oI: oldSow?.caveatsAndRisks?.assumptions, nI: newSow?.caveatsAndRisks?.assumptions },
    { label: "PM Tasks", oI: oldSow?.projectManagement?.tasks, nI: newSow?.projectManagement?.tasks },
    { label: "PM POCs", oI: oldSow?.projectManagement?.pocs, nI: newSow?.projectManagement?.pocs },
  ];

  const changedSections = sections.filter(s => textChanged(s.oV, s.nV));
  const unchangedSections = sections.filter(s => !textChanged(s.oV, s.nV));
  const changedLists = listSections.filter(s => arraysChanged(s.oI || [], s.nI || []));
  const unchangedLists = listSections.filter(s => !arraysChanged(s.oI || [], s.nI || []));

  const totalChanges = changedSections.length + changedLists.length +
    Array.from({ length: maxPhases }, (_, i) => {
      const op = oldOutline[i], np = newOutline[i];
      if (!op || !np) return true;
      return textChanged(op.phase, np.phase) || textChanged(op.objective, np.objective) || arraysChanged(op.tasks || [], np.tasks || []) || arraysChanged(op.deliverables || [], np.deliverables || []);
    }).filter(Boolean).length +
    Array.from({ length: maxRisks }, (_, i) => {
      const or2 = oldRisks[i], nr = newRisks[i];
      if (!or2 || !nr) return true;
      return ["risk", "impact", "likelihood", "mitigationDIT", "mitigationClient", "decision"].some(k => textChanged(or2[k], nr[k]));
    }).filter(Boolean).length;

  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-amber-600" />
          Version Comparison
        </CardTitle>
        <CardDescription>
          {totalChanges === 0 ? "No differences found between these versions." : `${totalChanges} section${totalChanges === 1 ? "" : "s"} changed`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {changedSections.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Changed Fields</h4>
            {changedSections.map(s => <DiffField key={s.label} label={s.label} oldVal={s.oV} newVal={s.nV} />)}
          </div>
        )}

        {changedLists.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Changed Lists</h4>
            {changedLists.map(s => <DiffList key={s.label} label={s.label} oldItems={s.oI || []} newItems={s.nI || []} />)}
          </div>
        )}

        {maxPhases > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Phases / Outline</h4>
            {Array.from({ length: maxPhases }, (_, i) => {
              const op = oldOutline[i], np = newOutline[i];
              const phaseModified = op && np && (textChanged(op.phase, np.phase) || textChanged(op.objective, np.objective) || arraysChanged(op.tasks || [], np.tasks || []) || arraysChanged(op.deliverables || [], np.deliverables || []));
              const phaseChanged = !op || !np || phaseModified;
              return (
                <div key={i} className={`rounded-md p-3 space-y-2 ${phaseChanged ? "bg-amber-50 border border-amber-200" : "bg-white border border-slate-100"}`} data-testid={`diff-phase-${i}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">Phase {i + 1}</span>
                    {!op && <span className="text-[10px] font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded">Added</span>}
                    {!np && <span className="text-[10px] font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded">Removed</span>}
                    {op && np && phaseModified && <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Changed</span>}
                  </div>
                  {op && np && phaseModified && (
                    <div className="space-y-2 pl-2">
                      {textChanged(op.phase, np.phase) && <DiffField label="Phase Name" oldVal={op.phase} newVal={np.phase} />}
                      {textChanged(op.objective, np.objective) && <DiffField label="Objective" oldVal={op.objective} newVal={np.objective} />}
                      {arraysChanged(op.tasks || [], np.tasks || []) && <DiffList label="Tasks" oldItems={op.tasks || []} newItems={np.tasks || []} />}
                      {arraysChanged(op.deliverables || [], np.deliverables || []) && <DiffList label="Deliverables" oldItems={op.deliverables || []} newItems={np.deliverables || []} />}
                    </div>
                  )}
                  {!phaseChanged && (
                    <p className="text-sm text-slate-500 pl-2">{op?.phase} — no changes</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {maxRisks > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Risks</h4>
            {Array.from({ length: maxRisks }, (_, i) => {
              const or2 = oldRisks[i], nr = newRisks[i];
              const riskModified = or2 && nr && ["risk", "impact", "likelihood", "mitigationDIT", "mitigationClient", "decision"].some(k => textChanged(or2[k], nr[k]));
              const riskChanged = !or2 || !nr || riskModified;
              return (
                <div key={i} className={`rounded-md p-3 space-y-2 ${riskChanged ? "bg-amber-50 border border-amber-200" : "bg-white border border-slate-100"}`} data-testid={`diff-risk-${i}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">Risk {i + 1}</span>
                    {!or2 && <span className="text-[10px] font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded">Added</span>}
                    {!nr && <span className="text-[10px] font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded">Removed</span>}
                    {or2 && nr && riskModified && <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Changed</span>}
                  </div>
                  {or2 && nr && riskModified && (
                    <div className="space-y-2 pl-2">
                      {["risk", "impact", "likelihood", "mitigationDIT", "mitigationClient", "decision"].filter(k => textChanged(or2[k], nr[k])).map(k => (
                        <DiffField key={k} label={k === "mitigationDIT" ? `${BRANDING.vendorAbbreviation} Mitigation` : k === "mitigationClient" ? "Client Mitigation" : k.charAt(0).toUpperCase() + k.slice(1)} oldVal={or2[k]} newVal={nr[k]} />
                      ))}
                    </div>
                  )}
                  {!riskChanged && <p className="text-sm text-slate-500 pl-2">{or2?.risk} — no changes</p>}
                </div>
              );
            })}
          </div>
        )}

        {unchangedSections.length + unchangedLists.length > 0 && totalChanges > 0 && (
          <details className="mt-4">
            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">Show {unchangedSections.length + unchangedLists.length} unchanged section{unchangedSections.length + unchangedLists.length === 1 ? "" : "s"}</summary>
            <div className="space-y-2 mt-2">
              {unchangedSections.map(s => <DiffField key={s.label} label={s.label} oldVal={s.oV} newVal={s.nV} />)}
              {unchangedLists.map(s => <DiffList key={s.label} label={s.label} oldItems={s.oI || []} newItems={s.nI || []} />)}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function SowDocument({ sow, onCopy, onHistory, versionCount, onSave, onExport }: { sow: any; onCopy: () => void; onHistory?: () => void; versionCount?: number; onSave?: (sow: any) => void; onExport?: (format: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [redoStack, setRedoStack] = useState<any[]>([]);
  const [grammarResults, setGrammarResults] = useState<string[] | null>(null);
  const [grammarChecking, setGrammarChecking] = useState(false);
  const { toast } = useToast();

  const likelihoodColor = (l: string) => {
    if (l === "High") return "bg-red-100 text-red-700 border-red-200";
    if (l === "Medium") return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  };

  const startEditing = () => {
    const initial = JSON.parse(JSON.stringify(sow));
    setDraft(initial);
    setUndoStack([]);
    setRedoStack([]);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(null);
    setUndoStack([]);
    setRedoStack([]);
    setIsEditing(false);
  };

  const saveEditing = () => {
    if (draft && onSave) {
      onSave(draft);
    }
    setIsEditing(false);
    setDraft(null);
    setUndoStack([]);
    setRedoStack([]);
  };

  const pushUndo = (currentDraft: any) => {
    setUndoStack((prev) => [...prev.slice(-49), JSON.parse(JSON.stringify(currentDraft))]);
    setRedoStack([]);
  };

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !draft) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, JSON.parse(JSON.stringify(draft))]);
    setUndoStack((u) => u.slice(0, -1));
    setDraft(prev);
  }, [undoStack, draft]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !draft) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, JSON.parse(JSON.stringify(draft))]);
    setRedoStack((r) => r.slice(0, -1));
    setDraft(next);
  }, [redoStack, draft]);

  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isEditing, handleUndo, handleRedo]);

  const moveItem = (path: string, fromIdx: number, direction: "up" | "down") => {
    if (!draft) return;
    const arr = getNestedValue(draft, path);
    if (!Array.isArray(arr)) return;
    const toIdx = direction === "up" ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= arr.length) return;
    const newArr = [...arr];
    [newArr[fromIdx], newArr[toIdx]] = [newArr[toIdx], newArr[fromIdx]];
    updateField(path, newArr);
  };

  const runGrammarCheck = async () => {
    setGrammarChecking(true);
    setGrammarResults(null);
    try {
      const checkDoc = isEditing && draft ? draft : sow;
      const csrf = getCsrfToken();
      const res = await fetch("/api/grammar-check", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
        body: JSON.stringify({ sowJson: checkDoc }),
      });
      if (!res.ok) throw new Error("Grammar check failed");
      const data = await res.json();
      setGrammarResults(data.suggestions || []);
    } catch (e) {
      toast({ title: "Grammar check failed", description: "Could not run the grammar check. Try again.", variant: "destructive" });
    } finally {
      setGrammarChecking(false);
    }
  };

  const d = isEditing && draft ? draft : sow;

  const parseKey = (k: string) => /^\d+$/.test(k) ? parseInt(k) : k;

  const updateField = (path: string, value: any) => {
    if (!draft) return;
    pushUndo(draft);
    const keys = path.split(".");
    const obj = JSON.parse(JSON.stringify(draft));
    let cur: any = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = parseKey(keys[i]);
      const nextKey = parseKey(keys[i + 1]);
      if (cur[key] === undefined) {
        cur[key] = typeof nextKey === "number" ? [] : {};
      }
      cur = cur[key];
    }
    cur[parseKey(keys[keys.length - 1])] = value;
    setDraft(obj);
  };

  const getNestedValue = (obj: any, path: string) => {
    const keys = path.split(".");
    let cur = obj;
    for (const k of keys) cur = cur?.[parseKey(k)];
    return cur;
  };

  const updateArrayItem = (path: string, index: number, value: string) => {
    if (!draft) return;
    const arr = getNestedValue(draft, path);
    if (!Array.isArray(arr)) return;
    const newArr = [...arr];
    newArr[index] = value;
    updateField(path, newArr);
  };

  const removeArrayItem = (path: string, index: number) => {
    if (!draft) return;
    const arr = getNestedValue(draft, path);
    if (!Array.isArray(arr)) return;
    updateField(path, arr.filter((_: any, i: number) => i !== index));
  };

  const addArrayItem = (path: string) => {
    if (!draft) return;
    const arr = getNestedValue(draft, path);
    updateField(path, [...(Array.isArray(arr) ? arr : []), ""]);
  };

  const inputCls = "border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 w-full bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white";
  const textareaCls = "border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 w-full bg-white resize-y min-h-[60px] dark:bg-slate-700 dark:border-slate-600 dark:text-white";

  const EditableList = ({ path, items, bulletColor = "text-blue-500", bulletChar = "•" }: { path: string; items: string[]; bulletColor?: string; bulletChar?: string }) => (
    <ul className="space-y-1.5">
      {(items || []).map((item: string, i: number) => (
        <li key={i} className="flex gap-2 text-slate-700 text-sm items-start">
          {isEditing ? (
            <>
              <input className={inputCls} value={item} onChange={(e) => updateArrayItem(path, i, e.target.value)} data-testid={`edit-${path}-${i}`} />
              <button onClick={() => removeArrayItem(path, i)} className="text-slate-400 hover:text-red-500 shrink-0 mt-1"><X className="w-3.5 h-3.5" /></button>
            </>
          ) : (
            <><span className={`${bulletColor} mt-0.5`}>{bulletChar}</span><span>{item}</span></>
          )}
        </li>
      ))}
      {isEditing && (
        <li>
          <button onClick={() => addArrayItem(path)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1" data-testid={`add-${path}`}>
            <Plus className="w-3 h-3" /> Add item
          </button>
        </li>
      )}
    </ul>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col"
    >
      <Card className="flex-1 shadow-sm border-slate-200 overflow-hidden flex flex-col dark:border-slate-700 dark:bg-slate-900">
        <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4 dark:bg-slate-800 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                {isEditing ? "Editing Scope of Work" : "Generated Scope of Work"}
              </CardTitle>
              <CardDescription className="mt-1">
                {isEditing ? "Click any field to edit. Save when done." : (sow.title || `Formatted to the ${BRANDING.vendorName} runbook v2 standard.`)}
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              {isEditing ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleUndo} disabled={undoStack.length === 0} title="Undo (Ctrl+Z)" data-testid="btn-undo">
                    <Undo2 className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRedo} disabled={redoStack.length === 0} title="Redo (Ctrl+Y)" data-testid="btn-redo">
                    <Redo2 className="w-4 h-4" />
                  </Button>
                  <Button variant="default" size="sm" onClick={saveEditing} data-testid="btn-save-edit">
                    <Save className="w-4 h-4 mr-1" /> Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={cancelEditing} data-testid="btn-cancel-edit">
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  {onSave && (
                    <Button variant="outline" size="sm" onClick={startEditing} data-testid="btn-edit">
                      <Pencil className="w-4 h-4 mr-1" /> Edit
                    </Button>
                  )}
                  {onHistory && (
                    <Button variant="outline" size="sm" onClick={onHistory} data-testid="btn-history">
                      <History className="w-4 h-4 mr-1" />
                      History{versionCount ? ` (${versionCount})` : ""}
                    </Button>
                  )}
                  {onExport && (
                    <div className="relative">
                      <Button variant="outline" size="sm" onClick={() => setShowExportMenu(!showExportMenu)} data-testid="btn-export" data-onboarding="review-export">
                        <Download className="w-4 h-4 mr-1" /> Export
                      </Button>
                      {showExportMenu && (
                        <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-md shadow-lg z-30 py-1 dark:bg-slate-800 dark:border-slate-700">
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium" onClick={() => { onExport("pdf"); setShowExportMenu(false); }} data-testid="export-pdf">
                            Export as PDF
                          </button>
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium" onClick={() => { onExport("docx"); setShowExportMenu(false); }} data-testid="export-docx">
                            Word — Client Summary
                          </button>
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium" onClick={() => { onExport("docx-detailed"); setShowExportMenu(false); }} data-testid="export-docx-detailed">
                            Word — Detailed
                          </button>
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium" onClick={() => { onExport("md"); setShowExportMenu(false); }} data-testid="export-md">
                            Export as Markdown
                          </button>
                          <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400" onClick={() => { onExport("jira-csv"); setShowExportMenu(false); }} data-testid="export-jira">
                            Export CSV (Jira)
                          </button>
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400" onClick={() => { onExport("asana-csv"); setShowExportMenu(false); }} data-testid="export-asana">
                            Export CSV (Asana)
                          </button>
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400" onClick={() => { onExport("json"); setShowExportMenu(false); }} data-testid="export-json">
                            Export JSON
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <Button variant="outline" size="sm" onClick={onCopy} data-testid="btn-copy">
                    <Copy className="w-4 h-4 mr-2" /> Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={runGrammarCheck} disabled={grammarChecking} data-testid="btn-grammar">
                    {grammarChecking ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <SpellCheck className="w-4 h-4 mr-1" />}
                    {grammarChecking ? "Checking..." : "Check Grammar"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <ScrollArea className="flex-1 p-0">
          <div className="p-6 md:p-8 space-y-8 max-w-3xl mx-auto bg-white dark:bg-slate-900" onClick={() => showExportMenu && setShowExportMenu(false)}>

            {grammarResults && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-2" data-testid="grammar-results">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-2">
                    <SpellCheck className="w-4 h-4" />
                    Grammar & Style Check ({grammarResults.length} suggestion{grammarResults.length !== 1 ? "s" : ""})
                  </h3>
                  <button onClick={() => setGrammarResults(null)} className="text-blue-400 hover:text-blue-600" data-testid="btn-close-grammar"><X className="w-4 h-4" /></button>
                </div>
                {grammarResults.length === 0 ? (
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">No issues found. Your document looks good.</p>
                ) : (
                  <ul className="space-y-2">
                    {grammarResults.map((s, i) => (
                      <li key={i} className="text-sm text-blue-900 dark:text-blue-200 flex gap-2 items-start" data-testid={`grammar-suggestion-${i}`}>
                        <span className="text-blue-400 mt-0.5 shrink-0">{i + 1}.</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="text-center pb-4 border-b">
              {isEditing ? (
                <>
                  <input className={`${inputCls} text-center text-2xl font-bold`} value={d.title || ""} onChange={(e) => updateField("title", e.target.value)} placeholder="Project Title" data-testid="edit-title" />
                  <input className={`${inputCls} text-center mt-2`} value={d.subtitle || ""} onChange={(e) => updateField("subtitle", e.target.value)} placeholder="Subtitle" data-testid="edit-subtitle" />
                  <input className={`${inputCls} text-center mt-2 max-w-xs mx-auto`} value={d.scopeType || ""} onChange={(e) => updateField("scopeType", e.target.value)} placeholder="Scope Type" data-testid="edit-scopeType" />
                </>
              ) : (
                <>
                  {d.title && <h1 className="text-2xl font-bold text-slate-900">{d.title}</h1>}
                  {d.subtitle && <p className="text-slate-600 mt-1">{d.subtitle}</p>}
                  {d.scopeType && <Badge variant="secondary" className="mt-2">{d.scopeType}</Badge>}
                </>
              )}
            </div>

            <section>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3 border-b dark:border-slate-700 pb-2">1. Summary</h2>
              {isEditing ? (
                <textarea className={textareaCls} value={d.summary || ""} onChange={(e) => updateField("summary", e.target.value)} rows={4} data-testid="edit-summary" />
              ) : (
                <p className="text-slate-700 leading-relaxed whitespace-pre-line">{d.summary}</p>
              )}
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3 border-b dark:border-slate-700 pb-2">2. Proposed Solution</h2>
              {isEditing ? (
                <textarea className={textareaCls} value={d.solution || ""} onChange={(e) => updateField("solution", e.target.value)} rows={4} data-testid="edit-solution" />
              ) : (
                <p className="text-slate-700 leading-relaxed whitespace-pre-line">{d.solution}</p>
              )}
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3 border-b dark:border-slate-700 pb-2">3. Prerequisites</h2>

              {d.responsibilityMatrix?.length > 0 ? (
                <>
                  {(d.accessPrerequisites?.length > 0 || isEditing) && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2 uppercase tracking-wide">Access and Readiness (Client Provided)</h3>
                      <EditableList path="accessPrerequisites" items={d.accessPrerequisites || []} />
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2 uppercase tracking-wide">Responsibilities</h3>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-600 rounded-md" data-testid="responsibility-matrix-table">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-900 text-white">
                            <th className="text-left px-3 py-2 font-semibold w-1/5">Area</th>
                            <th className="text-left px-3 py-2 font-semibold w-2/5">Client Responsibilities</th>
                            <th className="text-left px-3 py-2 font-semibold w-2/5">{BRANDING.vendorName} Responsibilities</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(d.responsibilityMatrix || []).map((row: any, i: number) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-750"} data-testid={`responsibility-row-${i}`}>
                              {isEditing ? (
                                <>
                                  <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-600">
                                    <input className={`${inputCls} w-full`} value={row.area || ""} onChange={(e) => {
                                      const matrix = [...(d.responsibilityMatrix || [])];
                                      matrix[i] = { ...matrix[i], area: e.target.value };
                                      updateField("responsibilityMatrix", matrix);
                                    }} data-testid={`edit-matrix-area-${i}`} />
                                  </td>
                                  <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-600">
                                    <input className={`${inputCls} w-full`} value={row.client || ""} onChange={(e) => {
                                      const matrix = [...(d.responsibilityMatrix || [])];
                                      matrix[i] = { ...matrix[i], client: e.target.value };
                                      updateField("responsibilityMatrix", matrix);
                                    }} data-testid={`edit-matrix-client-${i}`} />
                                  </td>
                                  <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-600">
                                    <input className={`${inputCls} w-full`} value={row.dit || ""} onChange={(e) => {
                                      const matrix = [...(d.responsibilityMatrix || [])];
                                      matrix[i] = { ...matrix[i], dit: e.target.value };
                                      updateField("responsibilityMatrix", matrix);
                                    }} data-testid={`edit-matrix-dit-${i}`} />
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-600 font-semibold text-slate-900 dark:text-white">{row.area}</td>
                                  <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300">{row.client}</td>
                                  <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300">{row.dit}</td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {isEditing && (
                      <button className="mt-2 text-xs text-blue-600 hover:text-blue-800" onClick={() => {
                        const matrix = [...(d.responsibilityMatrix || []), { area: "", client: "", dit: "" }];
                        updateField("responsibilityMatrix", matrix);
                      }} data-testid="add-matrix-row">+ Add Row</button>
                    )}
                  </div>

                  {(d.prerequisites?.thirdPartyResponsibilities?.length > 0 || isEditing) && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2 uppercase tracking-wide">Third-Party Responsibilities</h3>
                      <EditableList path="prerequisites.thirdPartyResponsibilities" items={d.prerequisites?.thirdPartyResponsibilities || []} />
                    </div>
                  )}

                  <details className="mt-2">
                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">Traditional Responsibility Lists</summary>
                    <div className="mt-2 space-y-3 pl-2 border-l-2 border-slate-200 dark:border-slate-600">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2 uppercase tracking-wide">Client Responsibilities</h3>
                        <EditableList path="prerequisites.clientResponsibilities" items={d.prerequisites?.clientResponsibilities || []} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2 uppercase tracking-wide">Vendor Responsibilities ({BRANDING.vendorName})</h3>
                        <EditableList path="prerequisites.vendorResponsibilities" items={d.prerequisites?.vendorResponsibilities || []} />
                      </div>
                    </div>
                  </details>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2 uppercase tracking-wide">Client Responsibilities</h3>
                    <EditableList path="prerequisites.clientResponsibilities" items={d.prerequisites?.clientResponsibilities || []} />
                  </div>
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2 uppercase tracking-wide">Vendor Responsibilities ({BRANDING.vendorName})</h3>
                    <EditableList path="prerequisites.vendorResponsibilities" items={d.prerequisites?.vendorResponsibilities || []} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2 uppercase tracking-wide">Third-Party Responsibilities</h3>
                    <EditableList path="prerequisites.thirdPartyResponsibilities" items={d.prerequisites?.thirdPartyResponsibilities || []} />
                  </div>
                </>
              )}
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3 border-b dark:border-slate-700 pb-2">4. Dependencies</h2>
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                <EditableList path="dependencies" items={d.dependencies || []} bulletColor="text-amber-600" />
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3 border-b dark:border-slate-700 pb-2">5. Project Management</h2>
              <div className="bg-slate-50 rounded-md p-4 border border-slate-100 space-y-2 mb-4 text-sm">
                {isEditing ? (
                  <>
                    <div>
                      <span className="font-semibold text-slate-900">Site Address:</span>
                      <input className={`${inputCls} mt-1`} value={d.projectManagement?.siteAddress || ""} onChange={(e) => updateField("projectManagement.siteAddress", e.target.value)} data-testid="edit-siteAddress" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">POCs:</span>
                      <EditableList path="projectManagement.pocs" items={d.projectManagement?.pocs || []} />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">Connectivity:</span>
                      <input className={`${inputCls} mt-1`} value={d.projectManagement?.siteInfo || ""} onChange={(e) => updateField("projectManagement.siteInfo", e.target.value)} data-testid="edit-siteInfo" />
                    </div>
                  </>
                ) : (
                  <>
                    {d.projectManagement?.siteAddress && (
                      <p><span className="font-semibold text-slate-900">Site Address:</span> <span className="text-slate-700">{d.projectManagement.siteAddress}</span></p>
                    )}
                    {d.projectManagement?.pocs?.length > 0 && (
                      <div>
                        <span className="font-semibold text-slate-900">POCs:</span>
                        <ul className="mt-1 space-y-1">
                          {d.projectManagement.pocs.map((p: string, i: number) => (
                            <li key={i} className="text-slate-700 ml-4">• {p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {d.projectManagement?.siteInfo && (
                      <p><span className="font-semibold text-slate-900">Connectivity:</span> <span className="text-slate-700">{d.projectManagement.siteInfo}</span></p>
                    )}
                  </>
                )}
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2 uppercase tracking-wide">Project Management Tasks</h3>
              <EditableList path="projectManagement.tasks" items={d.projectManagement?.tasks || []} bulletColor="text-slate-400" />
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3 border-b dark:border-slate-700 pb-2">6. High-Level Project Outline</h2>
              <div className="space-y-4">
                {(d.outline || []).map((phase: any, i: number) => (
                  <div key={i} className="border border-slate-200 rounded-md p-4">
                    {isEditing ? (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button onClick={() => moveItem("outline", i, "up")} disabled={i === 0} className="text-slate-400 hover:text-blue-600 disabled:opacity-30" title="Move up" data-testid={`move-phase-up-${i}`}><ArrowUp className="w-3.5 h-3.5" /></button>
                            <button onClick={() => moveItem("outline", i, "down")} disabled={i === (d.outline || []).length - 1} className="text-slate-400 hover:text-blue-600 disabled:opacity-30" title="Move down" data-testid={`move-phase-down-${i}`}><ArrowDown className="w-3.5 h-3.5" /></button>
                          </div>
                          <input className={`${inputCls} font-semibold`} value={phase.phase || ""} onChange={(e) => { const o = [...d.outline]; o[i] = { ...o[i], phase: e.target.value }; updateField("outline", o); }} data-testid={`edit-phase-name-${i}`} />
                          <button onClick={() => updateField("outline", d.outline.filter((_: any, j: number) => j !== i))} className="text-slate-400 hover:text-red-500 shrink-0"><X className="w-4 h-4" /></button>
                        </div>
                        <textarea className={`${textareaCls} mb-3`} value={phase.objective || ""} onChange={(e) => { const o = [...d.outline]; o[i] = { ...o[i], objective: e.target.value }; updateField("outline", o); }} placeholder="Phase objective" rows={2} data-testid={`edit-phase-obj-${i}`} />
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Tasks</p>
                            <EditableList path={`outline.${i}.tasks`} items={phase.tasks || []} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Deliverables</p>
                            <EditableList path={`outline.${i}.deliverables`} items={phase.deliverables || []} />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <h4 className="font-semibold text-slate-900 mb-2">{phase.phase}</h4>
                        <p className="text-sm text-slate-600 italic mb-3">{phase.objective}</p>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Tasks</p>
                            <ul className="space-y-1">
                              {(phase.tasks || []).map((t: string, j: number) => (
                                <li key={j} className="text-sm text-slate-700 flex gap-1.5"><ChevronRight className="w-3 h-3 mt-1 text-blue-400 shrink-0" /><span>{t}</span></li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Deliverables</p>
                            <ul className="space-y-1">
                              {(phase.deliverables || []).map((dd: string, j: number) => (
                                <li key={j} className="text-sm text-slate-700 flex gap-1.5"><CheckCircle2 className="w-3 h-3 mt-1 text-emerald-400 shrink-0" /><span>{dd}</span></li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {isEditing && (
                  <button onClick={() => updateField("outline", [...(d.outline || []), { phase: `Phase ${(d.outline || []).length + 1}: New Phase`, objective: "", tasks: [], deliverables: [] }])} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1" data-testid="add-phase">
                    <Plus className="w-4 h-4" /> Add Phase
                  </button>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3 border-b dark:border-slate-700 pb-2">7. Caveats / Risks</h2>

              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-2 uppercase tracking-wide">Assumptions</h3>
                <div className="bg-blue-50 border border-blue-100 rounded-md p-4">
                  <EditableList path="caveatsAndRisks.assumptions" items={d.caveatsAndRisks?.assumptions || []} bulletColor="text-blue-600" />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Risks</h3>
                {(d.caveatsAndRisks?.risks || []).map((risk: any, i: number) => (
                  <div key={i} className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-3">
                    {isEditing ? (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button onClick={() => moveItem("caveatsAndRisks.risks", i, "up")} disabled={i === 0} className="text-slate-400 hover:text-blue-600 disabled:opacity-30" title="Move up" data-testid={`move-risk-up-${i}`}><ArrowUp className="w-3.5 h-3.5" /></button>
                            <button onClick={() => moveItem("caveatsAndRisks.risks", i, "down")} disabled={i === (d.caveatsAndRisks?.risks || []).length - 1} className="text-slate-400 hover:text-blue-600 disabled:opacity-30" title="Move down" data-testid={`move-risk-down-${i}`}><ArrowDown className="w-3.5 h-3.5" /></button>
                          </div>
                          <input className={`${inputCls} font-semibold flex-1`} value={risk.risk || ""} onChange={(e) => { const r = [...d.caveatsAndRisks.risks]; r[i] = { ...r[i], risk: e.target.value }; updateField("caveatsAndRisks.risks", r); }} placeholder="Risk description" data-testid={`edit-risk-${i}`} />
                          <select className={`${inputCls} w-24`} value={risk.likelihood || "Medium"} onChange={(e) => { const r = [...d.caveatsAndRisks.risks]; r[i] = { ...r[i], likelihood: e.target.value }; updateField("caveatsAndRisks.risks", r); }} data-testid={`edit-risk-likelihood-${i}`}>
                            <option>Low</option><option>Medium</option><option>High</option>
                          </select>
                          <button onClick={() => updateField("caveatsAndRisks.risks", d.caveatsAndRisks.risks.filter((_: any, j: number) => j !== i))} className="text-slate-400 hover:text-red-500 shrink-0"><X className="w-4 h-4" /></button>
                        </div>
                        <input className={inputCls} value={risk.impact || ""} onChange={(e) => { const r = [...d.caveatsAndRisks.risks]; r[i] = { ...r[i], impact: e.target.value }; updateField("caveatsAndRisks.risks", r); }} placeholder="Impact" data-testid={`edit-risk-impact-${i}`} />
                        <div className="grid md:grid-cols-2 gap-3">
                          <input className={inputCls} value={risk.mitigationDIT || ""} onChange={(e) => { const r = [...d.caveatsAndRisks.risks]; r[i] = { ...r[i], mitigationDIT: e.target.value }; updateField("caveatsAndRisks.risks", r); }} placeholder={`Mitigation (${BRANDING.vendorName})`} data-testid={`edit-risk-mitDIT-${i}`} />
                          <input className={inputCls} value={risk.mitigationClient || ""} onChange={(e) => { const r = [...d.caveatsAndRisks.risks]; r[i] = { ...r[i], mitigationClient: e.target.value }; updateField("caveatsAndRisks.risks", r); }} placeholder="Mitigation (Client)" data-testid={`edit-risk-mitClient-${i}`} />
                        </div>
                        <input className={inputCls} value={risk.decision || ""} onChange={(e) => { const r = [...d.caveatsAndRisks.risks]; r[i] = { ...r[i], decision: e.target.value }; updateField("caveatsAndRisks.risks", r); }} placeholder="Decision/Dependency" data-testid={`edit-risk-decision-${i}`} />
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-2">
                          <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900 text-sm">{risk.risk}</span>
                              <Badge className={`text-xs ${likelihoodColor(risk.likelihood)}`}>{risk.likelihood}</Badge>
                            </div>
                            <p className="text-slate-600 text-xs mt-1">Impact: {risk.impact}</p>
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3 text-sm">
                          <div className="bg-white p-3 rounded border border-slate-100">
                            <p className="text-xs font-semibold text-blue-700 mb-1">Mitigation ({BRANDING.vendorName})</p>
                            <p className="text-slate-700 text-xs">{risk.mitigationDIT}</p>
                          </div>
                          <div className="bg-white p-3 rounded border border-slate-100">
                            <p className="text-xs font-semibold text-amber-700 mb-1">Mitigation (Client)</p>
                            <p className="text-slate-700 text-xs">{risk.mitigationClient}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500"><span className="font-semibold">Decision:</span> {risk.decision}</p>
                      </>
                    )}
                  </div>
                ))}
                {isEditing && (
                  <button onClick={() => updateField("caveatsAndRisks.risks", [...(d.caveatsAndRisks?.risks || []), { risk: "", impact: "", likelihood: "Medium", mitigationDIT: "", mitigationClient: "", decision: "" }])} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1" data-testid="add-risk">
                    <Plus className="w-4 h-4" /> Add Risk
                  </button>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3 border-b dark:border-slate-700 pb-2">8. Change Control</h2>
              {isEditing ? (
                <textarea className={textareaCls} value={d.changeControl || ""} onChange={(e) => updateField("changeControl", e.target.value)} rows={3} data-testid="edit-changeControl" />
              ) : (
                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">{d.changeControl}</p>
              )}
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3 border-b dark:border-slate-700 pb-2">9. Acceptance Criteria</h2>
              <EditableList path="completionCriteria" items={d.completionCriteria || []} bulletColor="text-emerald-500" />
            </section>

            {/* Approval — only shown when present (v2.1: excluded by default) */}
            {(d.approval || isEditing) && (
              <section className="pt-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3 border-b dark:border-slate-700 pb-2">Approval</h2>
                {isEditing ? (
                  <textarea className={textareaCls} value={typeof d.approval === "string" ? d.approval : ""} onChange={(e) => updateField("approval", e.target.value)} rows={2} data-testid="edit-approval" />
                ) : (
                  <p className="text-slate-600 text-sm mb-8 whitespace-pre-line">{typeof d.approval === "string" ? d.approval : ""}</p>
                )}
                {!isEditing && (
                  <div className="space-y-6 mt-8">
                    <div>
                      <div className="border-b border-slate-300 h-8"></div>
                      <p className="text-xs text-slate-500 mt-1">Client — Authorized Signature</p>
                      <p className="text-xs text-slate-400 mt-1">Printed Name: _____________ &nbsp; Date: _____________</p>
                    </div>
                    <div>
                      <div className="border-b border-slate-300 h-8"></div>
                      <p className="text-xs text-slate-500 mt-1">Provider — Authorized Signature</p>
                      <p className="text-xs text-slate-400 mt-1">Printed Name: _____________ &nbsp; Date: _____________</p>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* v2.1 Estimated Labor Hours (Role | Scope | Hours Range — no pricing) */}
            {d.laborHours?.rows?.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3 border-b dark:border-slate-700 pb-2">Estimated Labor Hours</h2>
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <table className="w-full text-sm" data-testid="labor-hours-table">
                    <thead>
                      <tr className="bg-slate-800 text-white text-xs uppercase tracking-wide">
                        <th className="text-left px-3 py-2 font-semibold">Role</th>
                        <th className="text-left px-3 py-2 font-semibold">Scope of Involvement</th>
                        <th className="text-right px-3 py-2 font-semibold">Est. Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.laborHours.rows.map((row: any, i: number) => (
                        <tr key={i} className={`border-t border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`} data-testid={`labor-row-${i}`}>
                          <td className="px-3 py-2 font-medium text-slate-900">{row.role}</td>
                          <td className="px-3 py-2 text-slate-600">{row.scope}</td>
                          <td className="px-3 py-2 text-right text-slate-900 font-medium">{row.hoursRange}</td>
                        </tr>
                      ))}
                    </tbody>
                    {d.laborHours.totalHoursRange && (
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                          <td className="px-3 py-2.5 text-slate-900">Total Estimated Hours</td>
                          <td></td>
                          <td className="px-3 py-2.5 text-right text-slate-900">{d.laborHours.totalHoursRange}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                {d.laborHours.notes?.length > 0 && (
                  <div className="mt-3">
                    {d.laborHours.notes.map((n: string, i: number) => (
                      <p key={i} className="text-xs text-slate-500 italic">{n}</p>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Legacy v2.0 Workload Estimate (with pricing) — shown only when no v2.1 labor hours */}
            {!d.laborHours?.rows?.length && (d.workloadEstimate?.lineItems?.length > 0 || isEditing) && (
              <section>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3 border-b dark:border-slate-700 pb-2">Workload Estimate</h2>
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <table className="w-full text-sm" data-testid="workload-table">
                    <thead>
                      <tr className="bg-slate-800 text-white text-xs uppercase tracking-wide">
                        <th className="text-left px-3 py-2 font-semibold">Role</th>
                        <th className="text-right px-3 py-2 font-semibold">Rate</th>
                        <th className="text-right px-3 py-2 font-semibold">Hours</th>
                        <th className="text-right px-3 py-2 font-semibold">Subtotal</th>
                        <th className="text-left px-3 py-2 font-semibold">Description</th>
                        {isEditing && <th className="w-8"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(d.workloadEstimate?.lineItems || []).map((li: any, i: number) => {
                        const sub = (li.rate || 0) * (li.hours || 0);
                        return (
                          <tr key={i} className={`border-t border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`} data-testid={`workload-row-${i}`}>
                            <td className="px-3 py-2 font-medium text-slate-900">
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <div className="flex flex-col gap-0.5 shrink-0">
                                    <button onClick={() => moveItem("workloadEstimate.lineItems", i, "up")} disabled={i === 0} className="text-slate-400 hover:text-blue-600 disabled:opacity-30" title="Move up" data-testid={`move-wl-up-${i}`}><ArrowUp className="w-3 h-3" /></button>
                                    <button onClick={() => moveItem("workloadEstimate.lineItems", i, "down")} disabled={i === (d.workloadEstimate?.lineItems || []).length - 1} className="text-slate-400 hover:text-blue-600 disabled:opacity-30" title="Move down" data-testid={`move-wl-down-${i}`}><ArrowDown className="w-3 h-3" /></button>
                                  </div>
                                  <select className={`${inputCls} w-full`} value={li.role} onChange={(e) => { const items = [...d.workloadEstimate.lineItems]; items[i] = { ...items[i], role: e.target.value, rate: ({ "Executive/Shareholder": 285, "Architect": 225, "Systems Engineer": 185, "Security Engineer": 225, "Project Manager": 185, "Network Technician": 185, "Field Technician": 185 } as any)[e.target.value] || items[i].rate }; updateField("workloadEstimate.lineItems", items); }} data-testid={`edit-wl-role-${i}`}>
                                    <option>Executive/Shareholder</option>
                                    <option>Architect</option>
                                    <option>Systems Engineer</option>
                                    <option>Security Engineer</option>
                                    <option>Project Manager</option>
                                    <option>Network Technician</option>
                                    <option>Field Technician</option>
                                  </select>
                                </div>
                              ) : li.role}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600">${li.rate}/hr</td>
                            <td className="px-3 py-2 text-right text-slate-900 font-medium">
                              {isEditing ? (
                                <input type="number" min="0" step="0.5" className={`${inputCls} w-20 text-right`} value={li.hours} onChange={(e) => { const items = [...d.workloadEstimate.lineItems]; items[i] = { ...items[i], hours: parseFloat(e.target.value) || 0 }; updateField("workloadEstimate.lineItems", items); }} data-testid={`edit-wl-hours-${i}`} />
                              ) : li.hours}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-900">${sub.toLocaleString()}</td>
                            <td className="px-3 py-2 text-slate-600">
                              {isEditing ? (
                                <input className={`${inputCls} w-full`} value={li.description} onChange={(e) => { const items = [...d.workloadEstimate.lineItems]; items[i] = { ...items[i], description: e.target.value }; updateField("workloadEstimate.lineItems", items); }} data-testid={`edit-wl-desc-${i}`} />
                              ) : li.description}
                            </td>
                            {isEditing && (
                              <td className="px-1 py-2">
                                <button onClick={() => updateField("workloadEstimate.lineItems", d.workloadEstimate.lineItems.filter((_: any, j: number) => j !== i))} className="text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                        <td className="px-3 py-2.5 text-slate-900">TOTAL</td>
                        <td></td>
                        <td className="px-3 py-2.5 text-right text-slate-900">{(d.workloadEstimate?.lineItems || []).reduce((s: number, li: any) => s + (li.hours || 0), 0)}</td>
                        <td className="px-3 py-2.5 text-right text-blue-700 text-base">${(d.workloadEstimate?.lineItems || []).reduce((s: number, li: any) => s + (li.rate || 0) * (li.hours || 0), 0).toLocaleString()}</td>
                        <td></td>
                        {isEditing && <td></td>}
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {isEditing && (
                  <button onClick={() => updateField("workloadEstimate.lineItems", [...(d.workloadEstimate?.lineItems || []), { role: "Systems Engineer", rate: 185, hours: 0, description: "" }])} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-2" data-testid="add-workload-item">
                    <Plus className="w-4 h-4" /> Add Role
                  </button>
                )}
                {(d.workloadEstimate?.notes || isEditing) && (
                  <div className="mt-3">
                    {isEditing ? (
                      <textarea className={textareaCls} value={d.workloadEstimate?.notes || ""} onChange={(e) => updateField("workloadEstimate.notes", e.target.value)} rows={2} placeholder="Notes about the estimate (travel, after-hours, etc.)" data-testid="edit-wl-notes" />
                    ) : d.workloadEstimate?.notes ? (
                      <p className="text-xs text-slate-500 italic mt-2">{d.workloadEstimate.notes}</p>
                    ) : null}
                  </div>
                )}
              </section>
            )}

            {(() => {
              const allText = [
                d.summary || "",
                d.solution || "",
                d.changeControl || d.caveatsAndRisks?.changeControl || "",
                typeof d.approval === "string" ? d.approval : "",
                ...(d.outline || []).map((p: any) => p.objective || ""),
                ...(d.caveatsAndRisks?.risks || []).map((r: any) => [r.risk, r.impact, r.mitigation, r.mitigationDIT, r.mitigationClient, r.decision].filter(Boolean).join(" ")),
              ].join(" ");
              const wordCount = allText.split(/\s+/).filter(Boolean).length;
              const filledSections = [
                d.summary, d.solution,
                d.prerequisites?.flat?.length || d.prerequisites?.clientResponsibilities?.length || d.prerequisites?.vendorResponsibilities?.length,
                d.projectManagement?.siteAddress || d.projectManagement?.tasks?.length || d.projectManagement?.contacts?.length,
                d.outline?.length,
                d.caveatsAndRisks?.assumptions?.length || d.caveatsAndRisks?.risks?.length || d.caveatsAndRisks?.exclusions?.length,
                d.changeControl || d.caveatsAndRisks?.changeControl,
                d.completionCriteria?.length,
                d.laborHours?.rows?.length || d.workloadEstimate?.lineItems?.length,
              ].filter(Boolean).length;
              const phases = (d.outline || []).length;
              const risks = (d.caveatsAndRisks?.risks || []).length;
              return (
                <div className="text-xs text-slate-400 dark:text-slate-500 py-3 border-t border-slate-100 dark:border-slate-700 mt-6 flex items-center justify-center gap-3" data-testid="sow-stats">
                  <span>~{wordCount} words</span>
                  <span>|</span>
                  <span>{filledSections}/9 sections</span>
                  <span>|</span>
                  <span>{phases} phase{phases !== 1 ? "s" : ""}</span>
                  <span>|</span>
                  <span>{risks} risk{risks !== 1 ? "s" : ""}</span>
                </div>
              );
            })()}
          </div>
        </ScrollArea>
      </Card>
    </motion.div>
  );
}

export default function Home() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [latestSow, setLatestSow] = useState<any | null>(null);
  const [showSow, setShowSow] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<any | null>(null);
  const [compareVersion, setCompareVersion] = useState<any | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", email: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">(() => {
    const stored = localStorage.getItem("caelum-theme-mode");
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
    return "system";
  });
  const [showDashboard, setShowDashboard] = useState(false);
  const [aiMode, setAiMode] = useState<string>(() => localStorage.getItem("caelum-ai-mode") || "auto");
  const [lastModelsUsed, setLastModelsUsed] = useState<string[]>([]);
  const [lastAiModeUsed, setLastAiModeUsed] = useState<string>("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [userRole, setUserRole] = useState<string>("User");
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = userRole !== "Viewer";
  const canDelete = ["Platform Owner", "Platform Admin", "Tenant Admin"].includes(userRole);

  useEffect(() => {
    fetchCsrfToken().catch(() => {});
    fetch("/api/auth/role").then(r => r.ok ? r.json() : null).then(d => { if (d?.role) setUserRole(d.role); }).catch(() => {});
  }, []);

  useEffect(() => {
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    localStorage.setItem("caelum-theme-mode", themeMode);

    if (themeMode === "dark") {
      applyTheme(true);
    } else if (themeMode === "light") {
      applyTheme(false);
    } else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(mq.matches);
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [themeMode]);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch {} finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const loadConversation = async (id: number) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setConversationId(data.conversation.id);
      setMessages(data.messages.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
      if (data.conversation.sowJson) {
        setLatestSow(data.conversation.sowJson);
      } else {
        const lastAssistant = data.messages.filter((m: any) => m.role === "assistant").pop();
        if (lastAssistant) {
          const sow = parseSow(lastAssistant.content);
          if (sow) setLatestSow(sow);
          else setLatestSow(null);
        } else {
          setLatestSow(null);
        }
      }
      setShowSow(false);
      setPendingFiles([]);
      setInput("");
      setShowVersionHistory(false);
      setVersions([]);
      setPreviewVersion(null);
      setCompareVersion(null);
    } catch {}
  };

  const deleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const csrf = getCsrfToken();
      await fetch(`/api/conversations/${id}`, { method: "DELETE", headers: csrf ? { "X-CSRF-Token": csrf } : {} });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) {
        handleNewConversation();
      }
    } catch {}
  };

  const toggleFlag = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const csrf = getCsrfToken();
      const res = await fetch(`/api/conversations/${id}/flag`, { method: "PATCH", headers: csrf ? { "X-CSRF-Token": csrf } : {} });
      const data = await res.json();
      setConversations((prev) => prev.map((c) => c.id === id ? { ...c, flagged: data.flagged } : c));
    } catch {}
  };

  const startRename = (id: number, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(currentTitle);
  };

  const commitRename = async (id: number) => {
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenamingId(null); return; }
    try {
      const csrf = getCsrfToken();
      await fetch(`/api/conversations/${id}/title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
        body: JSON.stringify({ title: trimmed }),
      });
      setConversations((prev) => prev.map((c) => c.id === id ? { ...c, title: trimmed } : c));
    } catch {}
    setRenamingId(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const csrf = getCsrfToken();
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setPendingFiles((prev) => [...prev, ...data.files]);
      toast({ title: "Files attached", description: `${data.files.length} file(s) ready to send.` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && pendingFiles.length === 0) || isStreaming) return;

    let fullContent = text;
    if (pendingFiles.length > 0) {
      const fileBlock = pendingFiles.map((f) =>
        `--- Attached File: ${f.name} ---\n${f.content}`
      ).join("\n\n");
      fullContent = text ? `${text}\n\n${fileBlock}` : fileBlock;
    }

    const userMsg: ChatMessage = { role: "user", content: fullContent };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setPendingFiles([]);
    setIsStreaming(true);

    try {
      const csrf = getCsrfToken();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
        body: JSON.stringify({ messages: newMessages, conversationId, aiMode }),
      });

      if (response.status === 401) {
        window.location.href = "/api/login";
        return;
      }

      if (!response.ok) {
        throw new Error("Chat request failed.");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let lineBuffer = "";
      let activeConvoId = conversationId;

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          lineBuffer += text;
          const parts = lineBuffer.split("\n");
          lineBuffer = parts.pop() || "";

          for (const line of parts) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.conversationId && !activeConvoId) {
                  activeConvoId = data.conversationId;
                  setConversationId(data.conversationId);
                }
                if (data.modelsUsed) {
                  setLastModelsUsed(data.modelsUsed);
                  setLastAiModeUsed(data.mode || "");
                }
                if (data.status) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: "assistant",
                      content: `*${data.status}*`,
                    };
                    return updated;
                  });
                }
                if (data.content) {
                  assistantContent += data.content;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: "assistant",
                      content: assistantContent,
                    };
                    return updated;
                  });
                }
                if (data.titleUpdate) {
                  setConversations((prev) => prev.map((c) => c.id === activeConvoId ? { ...c, title: data.titleUpdate } : c));
                }
                if (data.error) {
                  toast({ title: "Error", description: data.error, variant: "destructive" });
                }
              } catch {}
            }
          }
        }
      }

      const hasSowMarkers = assistantContent.includes("<<<SOW_START>>>") && assistantContent.includes("<<<SOW_END>>>");
      const sow = parseSow(assistantContent);
      if (sow) {
        setLatestSow(sow);
        setShowSow(true);
        if (activeConvoId) {
          const csrf3 = getCsrfToken();
          fetch(`/api/conversations/${activeConvoId}/sow`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...(csrf3 ? { "X-CSRF-Token": csrf3 } : {}) },
            body: JSON.stringify({ sowJson: sow }),
          }).catch(() => {});
        }
      } else if (hasSowMarkers) {
        toast({
          title: "SoW Parse Error",
          description: "The generated SoW could not be parsed. Try asking Claude to regenerate it.",
          variant: "destructive",
        });
      }

      loadConversations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDeleteMessage = async (index: number) => {
    const msg = messages[index];
    if (!msg?.id) return;
    try {
      const csrf = getCsrfToken();
      const res = await fetch(`/api/messages/${msg.id}`, { method: "DELETE", headers: csrf ? { "X-CSRF-Token": csrf } : {} });
      if (!res.ok) throw new Error("Failed to delete message");
      setMessages((prev) => prev.filter((_, i) => i !== index));
      toast({ title: "Deleted", description: "Message removed." });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const handleEditMessage = async (index: number) => {
    if (!conversationId || !editContent.trim()) return;
    const msg = messages[index];
    try {
      if (msg?.id) {
        const csrf2 = getCsrfToken();
        await fetch(`/api/conversations/${conversationId}/messages-after/${msg.id}`, { method: "DELETE", headers: csrf2 ? { "X-CSRF-Token": csrf2 } : {} });
      }
      const truncated = messages.slice(0, index);
      setMessages(truncated);
      setEditingMessageIndex(null);

      const userMsg: ChatMessage = { role: "user", content: editContent.trim() };
      const newMessages = [...truncated, userMsg];
      setMessages(newMessages);
      setInput("");
      setPendingFiles([]);
      setIsStreaming(true);

      const csrf = getCsrfToken();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
        body: JSON.stringify({ messages: newMessages, conversationId, aiMode }),
      });

      if (!response.ok) throw new Error("Chat request failed.");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let lineBuffer = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          lineBuffer += text;
          const parts = lineBuffer.split("\n");
          lineBuffer = parts.pop() || "";
          for (const line of parts) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.modelsUsed) {
                  setLastModelsUsed(data.modelsUsed);
                  setLastAiModeUsed(data.mode || "");
                }
                if (data.status) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "assistant", content: `*${data.status}*` };
                    return updated;
                  });
                }
                if (data.content) {
                  assistantContent += data.content;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                    return updated;
                  });
                }
                if (data.error) {
                  toast({ title: "Error", description: data.error, variant: "destructive" });
                }
              } catch {}
            }
          }
        }
      }

      const sow = parseSow(assistantContent);
      if (sow) {
        setLatestSow(sow);
        setShowSow(true);
        if (conversationId) {
          const csrfTk = getCsrfToken();
          fetch(`/api/conversations/${conversationId}/sow`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...(csrfTk ? { "X-CSRF-Token": csrfTk } : {}) },
            body: JSON.stringify({ sowJson: sow }),
          }).catch(() => {});
        }
      }
      loadConversations();
      if (conversationId) {
        setTimeout(() => loadConversation(conversationId), 500);
      }
    } catch (err: any) {
      toast({ title: "Edit failed", description: err.message, variant: "destructive" });
    } finally {
      setIsStreaming(false);
      setEditingMessageIndex(null);
    }
  };

  const handleRegenerate = async () => {
    if (isStreaming || messages.length < 2) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant") return;

    const lastUserIdx = messages.length - 2;
    const lastUserMsg = messages[lastUserIdx];
    if (lastUserMsg.role !== "user") return;

    try {
      if (lastMsg.id) {
        const csrf = getCsrfToken();
        await fetch(`/api/messages/${lastMsg.id}`, { method: "DELETE", headers: csrf ? { "X-CSRF-Token": csrf } : {} });
      }
      const truncated = messages.slice(0, -1);
      setMessages([...truncated, { role: "assistant", content: "" }]);
      setIsStreaming(true);

      const csrf = getCsrfToken();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
        body: JSON.stringify({ messages: truncated, conversationId, aiMode }),
      });

      if (!response.ok) throw new Error("Regenerate failed.");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let lineBuffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          lineBuffer += text;
          const parts = lineBuffer.split("\n");
          lineBuffer = parts.pop() || "";
          for (const line of parts) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.modelsUsed) {
                  setLastModelsUsed(data.modelsUsed);
                  setLastAiModeUsed(data.mode || "");
                }
                if (data.status) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "assistant", content: `*${data.status}*` };
                    return updated;
                  });
                }
                if (data.content) {
                  assistantContent += data.content;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                    return updated;
                  });
                }
                if (data.error) {
                  toast({ title: "Error", description: data.error, variant: "destructive" });
                }
              } catch {}
            }
          }
        }
      }

      const sow = parseSow(assistantContent);
      if (sow) {
        setLatestSow(sow);
        setShowSow(true);
        if (conversationId) {
          const csrfTk = getCsrfToken();
          fetch(`/api/conversations/${conversationId}/sow`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...(csrfTk ? { "X-CSRF-Token": csrfTk } : {}) },
            body: JSON.stringify({ sowJson: sow }),
          }).catch(() => {});
        }
      }
      loadConversations();
      if (conversationId) {
        setTimeout(() => loadConversation(conversationId), 500);
      }
    } catch (err: any) {
      toast({ title: "Regenerate failed", description: err.message, variant: "destructive" });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleBranch = async (index: number) => {
    const msg = messages[index];
    if (!msg?.id || !conversationId) return;
    try {
      const res = await fetch(`/api/conversations/${conversationId}/branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upToMessageId: msg.id }),
      });
      if (!res.ok) throw new Error("Failed to branch conversation");
      const data = await res.json();
      await loadConversations();
      setConversationId(data.conversation.id);
      setMessages(data.messages.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
      setLatestSow(null);
      setShowSow(false);
      toast({ title: "Branched", description: `New conversation created from this point.` });
    } catch (err: any) {
      toast({ title: "Branch failed", description: err.message, variant: "destructive" });
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    if (value.trim()) {
      setIsTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1500);
    } else {
      setIsTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const openProfile = () => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
      });
    }
    setShowProfile(true);
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const csrf = getCsrfToken();
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
        body: JSON.stringify(profileForm),
      });
      if (!res.ok) throw new Error("Failed to save profile");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Profile updated", description: "Your changes have been saved." });
      setShowProfile(false);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    setLatestSow(null);
    setShowSow(false);
    setInput("");
    setConversationId(null);
    setPendingFiles([]);
    setShowVersionHistory(false);
    setVersions([]);
    setPreviewVersion(null);
    setCompareVersion(null);
    setLastModelsUsed([]);
    setLastAiModeUsed("");
  };

  const handleCopySow = () => {
    if (!latestSow) return;
    navigator.clipboard.writeText(buildPlainText(latestSow)).then(() => {
      toast({ title: "Copied", description: "Full SoW copied to clipboard." });
    });
  };

  const handleSaveSow = async (editedSow: any) => {
    if (!conversationId) return;
    try {
      const csrf = getCsrfToken();
      const res = await fetch(`/api/conversations/${conversationId}/sow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
        body: JSON.stringify({ sowJson: editedSow, label: "Manual edit" }),
      });
      if (!res.ok) throw new Error("Save failed");
      setLatestSow(editedSow);
      toast({ title: "Saved", description: "SoW has been updated." });
      if (showVersionHistory) loadVersions();
      loadConversations();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
  };

  const handleExportSow = async (format: string) => {
    if (!latestSow) return;
    const slug = (latestSow.title || "sow-export").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sow-export";

    const csvEscape = (val: any) => {
      const s = String(val ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const downloadFile = (content: string, filename: string, mimeType: string) => {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    const downloadBlob = (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    if (format === "pdf" || format === "docx" || format === "docx-detailed" || format === "md") {
      if (!conversationId) {
        toast({ title: "Export failed", description: "Save the SoW first before exporting.", variant: "destructive" });
        return;
      }
      try {
        const res = await fetch(`/api/conversations/${conversationId}/export/${format}`, { method: "POST" });
        if (res.status === 401) {
          window.location.href = "/api/login";
          return;
        }
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Export failed");
        }
        const blob = await res.blob();
        const ext = format === "pdf" ? "pdf" : format === "md" ? "md" : "docx";
        const label = format === "md" ? "Markdown" : format === "docx-detailed" ? "Word (Detailed)" : format === "docx" ? "Word (Summary)" : "PDF";
        downloadBlob(blob, `sow-${slug}.${ext}`);
        toast({ title: "Exported", description: `${label} downloaded.` });
      } catch (err: any) {
        toast({ title: "Export failed", description: err.message, variant: "destructive" });
      }
      return;
    }

    if (format === "jira-csv") {
      const rows: string[][] = [["Summary", "Description", "Issue Type", "Priority", "Labels", "Component"]];
      (latestSow.outline || []).forEach((phase: any) => {
        (phase.tasks || []).forEach((task: string) => {
          rows.push([task, `Phase: ${phase.phase}\nObjective: ${phase.objective}`, "Task", "Medium", latestSow.scopeType || "", phase.phase]);
        });
      });
      (latestSow.projectManagement?.tasks || []).forEach((task: string) => {
        rows.push([task, "Project Management task", "Task", "Medium", latestSow.scopeType || "", "Project Management"]);
      });
      const csv = rows.map(r => r.map(csvEscape).join(",")).join("\n");
      downloadFile(csv, `sow-tasks-jira-${slug}.csv`, "text/csv");
      toast({ title: "Exported", description: "Jira CSV downloaded." });
    } else if (format === "asana-csv") {
      const rows: string[][] = [["Name", "Section/Column", "Description", "Due Date", "Assignee"]];
      (latestSow.outline || []).forEach((phase: any) => {
        (phase.tasks || []).forEach((task: string) => {
          rows.push([task, phase.phase, phase.objective || "", "", ""]);
        });
      });
      (latestSow.projectManagement?.tasks || []).forEach((task: string) => {
        rows.push([task, "Project Management", "", "", ""]);
      });
      const csv = rows.map(r => r.map(csvEscape).join(",")).join("\n");
      downloadFile(csv, `sow-tasks-asana-${slug}.csv`, "text/csv");
      toast({ title: "Exported", description: "Asana CSV downloaded." });
    } else if (format === "json") {
      downloadFile(JSON.stringify(latestSow, null, 2), `sow-${slug}.json`, "application/json");
      toast({ title: "Exported", description: "JSON file downloaded." });
    }
  };

  const loadVersions = async () => {
    if (!conversationId) return;
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
      }
    } catch {} finally {
      setLoadingVersions(false);
    }
  };

  const handleOpenHistory = () => {
    setShowVersionHistory(true);
    setPreviewVersion(null);
    setCompareVersion(null);
    loadVersions();
  };

  const handleRestoreVersion = async (versionId: number) => {
    if (!conversationId) return;
    try {
      const res = await fetch(`/api/conversations/${conversationId}/versions/${versionId}/restore`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Restore failed");
      const data = await res.json();
      setLatestSow(data.sowJson);
      setPreviewVersion(null);
      setCompareVersion(null);
      toast({ title: "Restored", description: "SoW has been restored to the selected version." });
      loadVersions();
      loadConversations();
    } catch (err: any) {
      toast({ title: "Restore failed", description: err.message, variant: "destructive" });
    }
  };

  const hasMessages = messages.length > 0;

  function renderMessageContent(content: string) {
    const sow = parseSow(content);
    const textOnly = stripSowMarkers(content);

    return (
      <>
        {textOnly && <p className="whitespace-pre-wrap">{textOnly}</p>}
        {sow && (
          <button
            onClick={() => { setLatestSow(sow); setShowSow(true); }}
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
            data-testid="btn-view-sow"
          >
            <FileText className="w-4 h-4" />
            View Generated SoW
          </button>
        )}
      </>
    );
  }

  function renderUserContent(content: string) {
    const fileRegex = /--- Attached File: (.+?) ---\n[\s\S]*?(?=--- Attached File:|$)/g;
    const hasFiles = content.includes("--- Attached File:");
    if (!hasFiles) return <p className="whitespace-pre-wrap">{content}</p>;

    const firstFileIdx = content.indexOf("--- Attached File:");
    const userText = content.substring(0, firstFileIdx).trim();
    const fileNames: string[] = [];
    let match;
    while ((match = fileRegex.exec(content)) !== null) {
      fileNames.push(match[1]);
    }

    return (
      <>
        {userText && <p className="whitespace-pre-wrap">{userText}</p>}
        {fileNames.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {fileNames.map((name, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-blue-500/20 text-blue-100 px-2 py-0.5 rounded">
                <Paperclip className="w-3 h-3" />
                {name}
              </span>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col font-sans bg-slate-50 dark:bg-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 dark:bg-slate-800 dark:border-slate-700">
        <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-slate-500"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              data-testid="btn-toggle-sidebar"
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
            </Button>
            <div className="bg-blue-600 p-1.5 rounded-md">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-900 dark:text-white text-sm leading-tight">{BRANDING.appName}</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Scope of Work Builder</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" onClick={handleNewConversation} data-testid="btn-new-chat">
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
            )}
            <Button
              variant={showDashboard ? "default" : "outline"}
              size="sm"
              onClick={() => { setShowDashboard(!showDashboard); if (!showDashboard) setShowSow(false); }}
              data-testid="btn-dashboard"
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Dashboard
            </Button>
            {latestSow && (
              <Button
                variant={showSow ? "default" : "outline"}
                size="sm"
                onClick={() => { setShowSow(!showSow); setShowDashboard(false); }}
                data-testid="btn-toggle-sow"
              >
                <FileText className="w-4 h-4 mr-1" />
                {showSow ? "Chat" : "View SoW"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 p-0 px-1.5 text-slate-500 dark:text-slate-400 gap-1"
              onClick={() => setThemeMode(themeMode === "light" ? "dark" : themeMode === "dark" ? "system" : "light")}
              data-testid="btn-dark-mode"
              title={`Theme: ${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}`}
            >
              {themeMode === "light" ? <Sun className="w-4 h-4" /> : themeMode === "dark" ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              <span className="text-[10px] font-medium hidden sm:inline">{themeMode === "system" ? "Auto" : themeMode === "dark" ? "Dark" : "Light"}</span>
            </Button>
            {user && (
              <div className="relative ml-2">
                <button onClick={openProfile} className="flex items-center gap-2 hover:opacity-80 transition-opacity" data-testid="btn-profile">
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={user.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
                      {(user.firstName?.[0] || user.email?.[0] || "U").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
                {showProfile && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)} />
                    <div className="absolute right-0 top-10 w-72 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-4 dark:bg-slate-800 dark:border-slate-700" data-testid="profile-panel">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-900">Profile</h3>
                        <button onClick={() => setShowProfile(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={user.profileImageUrl || undefined} />
                          <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-semibold">
                            {(user.firstName?.[0] || user.email?.[0] || "U").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{user.firstName} {user.lastName}</p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-slate-600 block mb-1">First Name</label>
                          <input
                            className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                            value={profileForm.firstName}
                            onChange={(e) => setProfileForm((p) => ({ ...p, firstName: e.target.value }))}
                            data-testid="input-profile-firstName"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600 block mb-1">Last Name</label>
                          <input
                            className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                            value={profileForm.lastName}
                            onChange={(e) => setProfileForm((p) => ({ ...p, lastName: e.target.value }))}
                            data-testid="input-profile-lastName"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600 block mb-1">Email</label>
                          <input
                            type="email"
                            className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                            value={profileForm.email}
                            onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))}
                            data-testid="input-profile-email"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                        <Button size="sm" onClick={saveProfile} disabled={savingProfile} className="flex-1" data-testid="btn-save-profile">
                          {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                          Save
                        </Button>
                        <a href="/api/logout" className="flex-1">
                          <Button variant="outline" size="sm" className="w-full text-slate-500" data-testid="btn-logout">
                            <LogOut className="w-3.5 h-3.5 mr-1" /> Sign Out
                          </Button>
                        </a>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-r border-slate-200 bg-white flex flex-col overflow-hidden shrink-0 dark:bg-slate-800 dark:border-slate-700"
            >
              <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Scopes</h2>
                <div className="relative mt-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search scopes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-7 pr-7 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                    data-testid="input-search"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-0.5">
                  {loadingConversations && (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                  {!loadingConversations && conversations.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-8 px-4">No scopes yet. Start a new conversation to create one.</p>
                  )}
                  {(() => {
                    const filtered = conversations.filter((c) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      if (c.title.toLowerCase().includes(q)) return true;
                      if (c.sowJson && JSON.stringify(c.sowJson).toLowerCase().includes(q)) return true;
                      return false;
                    });
                    if (!loadingConversations && conversations.length > 0 && filtered.length === 0) {
                      return <p className="text-xs text-slate-400 text-center py-8 px-4">No results for "{searchQuery}"</p>;
                    }
                    const sorted = [...filtered].sort((a, b) => {
                      if (a.flagged && !b.flagged) return -1;
                      if (!a.flagged && b.flagged) return 1;
                      return 0;
                    });
                    return sorted.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => loadConversation(c.id)}
                        className={`group flex items-start gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                          conversationId === c.id
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                        }`}
                        data-testid={`convo-item-${c.id}`}
                      >
                        <button
                          onClick={(e) => toggleFlag(c.id, e)}
                          className={`shrink-0 mt-0.5 transition-colors ${c.flagged ? "text-amber-400" : "opacity-0 group-hover:opacity-100 text-slate-300 hover:text-amber-400"}`}
                          data-testid={`btn-flag-convo-${c.id}`}
                        >
                          <Star className={`w-3.5 h-3.5 ${c.flagged ? "fill-amber-400" : ""}`} />
                        </button>
                        {renamingId === c.id ? (
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => commitRename(c.id)}
                            onKeyDown={(e) => { if (e.key === "Enter") commitRename(c.id); if (e.key === "Escape") setRenamingId(null); }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 text-xs bg-white border border-blue-300 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 dark:bg-slate-700 dark:border-slate-500 dark:text-white"
                            data-testid={`input-rename-convo-${c.id}`}
                          />
                        ) : (
                          <span
                            className="flex-1 text-xs break-words line-clamp-2 min-w-0"
                            onDoubleClick={(e) => startRename(c.id, c.title, e)}
                          >
                            {c.title}
                          </span>
                        )}
                        <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                        {c.sowJson && renamingId !== c.id && (
                          <FileText className="w-3 h-3 text-emerald-500" />
                        )}
                        {canDelete && renamingId !== c.id && (
                          <button
                            onClick={(e) => deleteConversation(c.id, e)}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                            data-testid={`btn-delete-convo-${c.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </ScrollArea>
            </motion.aside>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-hidden flex">
          <AnimatePresence mode="wait">
            {showDashboard ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-auto p-6"
              >
                <ErrorBoundary fallbackTitle="Dashboard Error" fallbackMessage="The dashboard encountered an error. Chat and SoW viewer are still available.">
                <div className="max-w-5xl mx-auto" data-testid="dashboard-view">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Dashboard</h2>
                  {(() => {
                    const sowConvos = conversations.filter((c) => c.sowJson);
                    const totalScopes = sowConvos.length;
                    const scopeTypes: Record<string, number> = {};
                    let totalHours = 0;
                    let totalCost = 0;
                    let totalRisks = 0;
                    const riskByLikelihood: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
                    sowConvos.forEach((c) => {
                      const s = c.sowJson;
                      const st = s.scopeType || "Unspecified";
                      scopeTypes[st] = (scopeTypes[st] || 0) + 1;
                      // v2.1: labor hours (no pricing); v2.0: workload estimate (with pricing)
                      if (s.laborHours?.rows?.length) {
                        // v2.1 uses hour ranges like "8–12", take the midpoint for dashboard stats
                        (s.laborHours.rows || []).forEach((row: any) => {
                          const range = String(row.hoursRange || "0");
                          const parts = range.split(/[–-]/).map((p: string) => parseFloat(p.trim()) || 0);
                          totalHours += parts.length === 2 ? (parts[0] + parts[1]) / 2 : parts[0];
                        });
                      } else {
                        (s.workloadEstimate?.lineItems || []).forEach((li: any) => {
                          totalHours += li.hours || 0;
                          totalCost += (li.rate || 0) * (li.hours || 0);
                        });
                      }
                      (s.caveatsAndRisks?.risks || []).forEach((r: any) => {
                        totalRisks++;
                        const l = r.likelihood || "Medium";
                        riskByLikelihood[l] = (riskByLikelihood[l] || 0) + 1;
                      });
                    });
                    const recent = [...conversations].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);
                    return (
                      <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                          <div className="bg-white border border-slate-200 rounded-lg p-4 dark:bg-slate-800 dark:border-slate-700" data-testid="stat-total-scopes">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Scopes</p>
                            <p className="text-3xl font-bold text-blue-600 mt-1">{totalScopes}</p>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-lg p-4 dark:bg-slate-800 dark:border-slate-700" data-testid="stat-total-hours">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Hours</p>
                            <p className="text-3xl font-bold text-emerald-600 mt-1">{totalHours.toLocaleString()}</p>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-lg p-4 dark:bg-slate-800 dark:border-slate-700" data-testid="stat-total-cost">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Cost</p>
                            <p className="text-3xl font-bold text-amber-600 mt-1">${totalCost.toLocaleString()}</p>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-lg p-4 dark:bg-slate-800 dark:border-slate-700" data-testid="stat-total-risks">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Risks</p>
                            <p className="text-3xl font-bold text-red-600 mt-1">{totalRisks}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="bg-white border border-slate-200 rounded-lg p-5 dark:bg-slate-800 dark:border-slate-700">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Scope Types</h3>
                            {Object.keys(scopeTypes).length === 0 ? (
                              <p className="text-sm text-slate-400">No scopes generated yet.</p>
                            ) : (
                              <div className="space-y-3">
                                {Object.entries(scopeTypes).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                                  <div key={type} className="flex items-center justify-between">
                                    <span className="text-sm text-slate-700 dark:text-slate-300">{type}</span>
                                    <div className="flex items-center gap-2">
                                      <div className="w-24 h-2 bg-slate-100 dark:bg-slate-600 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (count / totalScopes) * 100)}%` }} />
                                      </div>
                                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-6 text-right">{count}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {totalRisks > 0 && (
                              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">Risk Distribution</h4>
                                <div className="flex gap-3">
                                  {(["High", "Medium", "Low"] as const).map((level) => (
                                    <div key={level} className={`flex-1 text-center rounded-md py-2 ${
                                      level === "High" ? "bg-red-50 dark:bg-red-900/20" : level === "Medium" ? "bg-amber-50 dark:bg-amber-900/20" : "bg-emerald-50 dark:bg-emerald-900/20"
                                    }`}>
                                      <p className={`text-lg font-bold ${level === "High" ? "text-red-600" : level === "Medium" ? "text-amber-600" : "text-emerald-600"}`}>{riskByLikelihood[level]}</p>
                                      <p className="text-xs text-slate-500 dark:text-slate-400">{level}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="bg-white border border-slate-200 rounded-lg p-5 dark:bg-slate-800 dark:border-slate-700">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Recent Activity</h3>
                            {recent.length === 0 ? (
                              <p className="text-sm text-slate-400">No conversations yet.</p>
                            ) : (
                              <div className="space-y-3">
                                {recent.map((c) => (
                                  <div key={c.id} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md p-2 -mx-2 transition-colors" onClick={() => { loadConversation(c.id); setShowDashboard(false); }}>
                                    <div className={`w-8 h-8 rounded-md flex items-center justify-center ${c.sowJson ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-slate-100 dark:bg-slate-700"}`}>
                                      {c.sowJson ? <FileText className="w-4 h-4 text-emerald-600" /> : <MessageSquare className="w-4 h-4 text-slate-400" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{c.title}</p>
                                      <p className="text-xs text-slate-400">{new Date(c.updatedAt).toLocaleDateString()}</p>
                                    </div>
                                    {c.sowJson && <Badge variant="secondary" className="text-[10px] shrink-0">SoW</Badge>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                </ErrorBoundary>
              </motion.div>
            ) : showSow && latestSow ? (
              <motion.div
                key="sow"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex-1 flex overflow-hidden"
              >
                <ErrorBoundary fallbackTitle="SoW Viewer Error" fallbackMessage="The SoW viewer encountered an error. Chat and sidebar are still available.">
                <div className="flex-1 p-4 overflow-auto">
                  <div className={compareVersion ? "max-w-7xl mx-auto" : "max-w-4xl mx-auto"}>
                    {compareVersion ? (
                      <div data-testid="compare-view">
                        <div className="flex items-center gap-2 mb-4">
                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                            <ArrowLeftRight className="w-3 h-3 mr-1" />
                            Comparing v{compareVersion.version} vs Current
                          </Badge>
                          <span className="text-xs text-slate-500">{compareVersion.label}</span>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setCompareVersion(null)} data-testid="btn-close-compare">
                            <X className="w-3 h-3 mr-1" /> Close comparison
                          </Button>
                        </div>
                        <VersionDiff oldSow={compareVersion.sowJson} newSow={latestSow} oldLabel={`v${compareVersion.version}`} newLabel="Current" />
                      </div>
                    ) : previewVersion ? (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="secondary" className="text-xs">
                            <Eye className="w-3 h-3 mr-1" />
                            Previewing v{previewVersion.version}
                          </Badge>
                          <span className="text-xs text-slate-500">{previewVersion.label}</span>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setPreviewVersion(null)} data-testid="btn-close-preview">
                            <X className="w-3 h-3 mr-1" /> Back to current
                          </Button>
                        </div>
                        <SowDocument sow={previewVersion.sowJson} onCopy={() => {
                          navigator.clipboard.writeText(buildPlainText(previewVersion.sowJson)).then(() => {
                            toast({ title: "Copied", description: `v${previewVersion.version} SoW copied to clipboard.` });
                          });
                        }} />
                      </div>
                    ) : (
                      <SowDocument
                        sow={latestSow}
                        onCopy={handleCopySow}
                        onHistory={conversationId ? handleOpenHistory : undefined}
                        versionCount={versions.length}
                        onSave={canEdit && conversationId ? handleSaveSow : undefined}
                        onExport={handleExportSow}
                      />
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {showVersionHistory && (
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 320, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-l border-slate-200 bg-white flex flex-col overflow-hidden shrink-0"
                    >
                      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                          <History className="w-4 h-4" />
                          Version History
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => { setShowVersionHistory(false); setPreviewVersion(null); setCompareVersion(null); }}
                          data-testid="btn-close-history"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <ScrollArea className="flex-1">
                        <div className="p-2 space-y-1">
                          {loadingVersions && (
                            <div className="flex items-center justify-center py-8 text-slate-400">
                              <Loader2 className="w-4 h-4 animate-spin" />
                            </div>
                          )}
                          {!loadingVersions && versions.length === 0 && (
                            <p className="text-xs text-slate-400 text-center py-8 px-4">No versions yet. Versions are created each time a SoW is generated.</p>
                          )}
                          {versions.map((v, i) => (
                            <div
                              key={v.id}
                              className={`rounded-md border p-3 space-y-2 ${
                                i === 0 && !previewVersion ? "border-blue-200 bg-blue-50/50" : "border-slate-100 bg-white"
                              }`}
                              data-testid={`version-item-${v.id}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-800">v{v.version}</span>
                                {i === 0 && !previewVersion && (
                                  <Badge variant="secondary" className="text-[10px] py-0">Current</Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">{v.label}</p>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                <Clock className="w-3 h-3" />
                                {new Date(v.createdAt).toLocaleString()}
                              </div>
                              <div className="flex gap-1.5 pt-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs px-2 flex-1"
                                  onClick={() => { setPreviewVersion(v); setCompareVersion(null); }}
                                  data-testid={`btn-preview-${v.id}`}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  Preview
                                </Button>
                                {i !== 0 && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 text-xs px-2 flex-1"
                                      onClick={() => { setCompareVersion(v); setPreviewVersion(null); }}
                                      data-testid={`btn-compare-${v.id}`}
                                    >
                                      <ArrowLeftRight className="w-3 h-3 mr-1" />
                                      Compare
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 text-xs px-2 flex-1"
                                      onClick={() => handleRestoreVersion(v.id)}
                                      data-testid={`btn-restore-${v.id}`}
                                    >
                                      <RotateCcw className="w-3 h-3 mr-1" />
                                      Restore
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </motion.div>
                  )}
                </AnimatePresence>
                </ErrorBoundary>
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col max-w-3xl mx-auto w-full"
              >
                <ErrorBoundary fallbackTitle="Chat Error" fallbackMessage="The chat panel encountered an error. Use the sidebar to navigate or try again.">
                <ScrollArea className="flex-1 px-4" data-onboarding="ai-refine">
                  <div className="py-6 space-y-4">
                    {!hasMessages && (
                      <div className="flex flex-col items-center justify-center text-center pt-16 pb-8" data-onboarding="welcome">
                        <div className="mb-6">
                          <DuckyMascot state="idle" size="lg" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">What are we scoping?</h2>
                        <p className="text-slate-500 dark:text-slate-400 max-w-md text-sm mb-8">
                          Pick a template to get started, or paste your messy notes below. You can also attach files — PDFs, Word docs, spreadsheets, or anything else.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl w-full" data-onboarding="create-sow">
                          {SOW_TEMPLATES.map((tmpl, i) => {
                            const Icon = tmpl.icon;
                            return (
                              <div
                                key={i}
                                onClick={() => { if (tmpl.starter) setInput(tmpl.starter); }}
                                className="border border-slate-200 rounded-lg p-4 text-left hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition-colors group dark:border-slate-700 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
                                data-testid={`template-${i}`}
                              >
                                <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center mb-2 group-hover:bg-blue-200 transition-colors">
                                  <Icon className="w-4 h-4 text-blue-600" />
                                </div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{tmpl.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{tmpl.description}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {messages.map((msg, i) => {
                      const isLastAssistant = msg.role === "assistant" && isStreaming && i === messages.length - 1;
                      const showThinking = isLastAssistant && !msg.content;
                      const showCursor = isLastAssistant && !!msg.content;
                      const isEditing = editingMessageIndex === i;
                      const canShowActions = !isStreaming && !isEditing;
                      const isLastMsg = i === messages.length - 1;
                      const showRegenerate = msg.role === "assistant" && isLastMsg && !isStreaming && msg.content && messages.length >= 2;

                      return (
                      <div
                        key={i}
                        className={`flex gap-3 group/msg ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {msg.role === "assistant" && (
                          <div className="shrink-0 mt-1">
                            <DuckyMascot
                              state={showThinking ? "thinking" : showCursor ? "presenting" : "idle"}
                              size="sm"
                            />
                          </div>
                        )}
                        <div className="flex flex-col max-w-[85%]">
                        {isEditing ? (
                          <div className="space-y-2" data-testid={`msg-${msg.role}-${i}`}>
                            <textarea
                              className="w-full min-h-[80px] rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              data-testid="input-edit-msg"
                              autoFocus
                            />
                            <div className="flex gap-1.5">
                              <Button size="sm" className="h-7 text-xs px-3" onClick={() => handleEditMessage(i)} data-testid="btn-save-edit">
                                <Save className="w-3 h-3 mr-1" /> Save & Resend
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs px-3" onClick={() => setEditingMessageIndex(null)} data-testid="btn-cancel-edit">
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                        <div
                          className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                            msg.role === "user"
                              ? "bg-blue-600 text-white"
                              : "bg-white border border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                          }`}
                          data-testid={`msg-${msg.role}-${i}`}
                        >
                          {showThinking ? (
                            <div className="flex items-center gap-3 py-1">
                              <div className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                              <span className="text-xs text-slate-400 italic">Thinking...</span>
                            </div>
                          ) : (
                            <>
                              {msg.role === "assistant"
                                ? renderMessageContent(msg.content)
                                : renderUserContent(msg.content)
                              }
                              {showCursor && (
                                <span className="inline-block w-1.5 h-4 bg-blue-500 ml-0.5 animate-pulse rounded-sm align-middle" />
                              )}
                            </>
                          )}
                        </div>
                        )}
                        {canShowActions && !isEditing && (
                          <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity mt-1 flex items-center gap-0.5">
                            {msg.role === "assistant" && msg.content && !showCursor && (
                              <CopyButton text={stripSowMarkers(msg.content)} />
                            )}
                            {canEdit && msg.role === "user" && (
                              <button
                                className="h-6 w-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500 transition-colors"
                                title="Edit message"
                                onClick={() => { setEditingMessageIndex(i); setEditContent(msg.content); }}
                                data-testid={`btn-edit-msg-${i}`}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            {msg.id && (
                              <>
                                {canDelete && (
                                  <button
                                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 transition-colors"
                                    title="Delete message"
                                    onClick={() => handleDeleteMessage(i)}
                                    data-testid={`btn-delete-msg-${i}`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                                {canEdit && (
                                  <button
                                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-emerald-500 transition-colors"
                                    title="Branch from here"
                                    onClick={() => handleBranch(i)}
                                    data-testid={`btn-branch-msg-${i}`}
                                  >
                                    <GitBranch className="w-3 h-3" />
                                  </button>
                                )}
                              </>
                            )}
                            {showRegenerate && (
                              <button
                                className="h-6 w-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-amber-500 transition-colors"
                                title="Regenerate response"
                                onClick={handleRegenerate}
                                data-testid="btn-regenerate"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                        </div>
                        {msg.role === "user" && !isEditing && (
                          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-1">
                            <User className="w-4 h-4 text-slate-600" />
                          </div>
                        )}
                      </div>
                    );})}

                    {isTyping && hasMessages && !isStreaming && (
                      <div className="flex gap-3 justify-end" data-testid="typing-indicator">
                        <div className="flex flex-col items-end">
                          <div className="rounded-xl px-4 py-2 bg-blue-500/20 border border-blue-300/30 text-sm">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                              <span className="text-[10px] text-slate-400 ml-1 italic">Composing...</span>
                            </div>
                          </div>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-1">
                          <User className="w-4 h-4 text-slate-600" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>

                <div className="border-t border-slate-200 bg-white p-4 dark:bg-slate-800 dark:border-slate-700">
                  <div className="flex items-center gap-2 max-w-3xl mx-auto mb-2">
                    <div className="relative" data-testid="ai-mode-selector">
                      <select
                        value={aiMode}
                        onChange={(e) => { setAiMode(e.target.value); localStorage.setItem("caelum-ai-mode", e.target.value); }}
                        className="appearance-none text-xs pl-7 pr-6 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300"
                        disabled={isStreaming}
                      >
                        <option value="auto">Auto (Smart Route)</option>
                        <option value="ensemble">Ensemble (Multi-Model)</option>
                        <optgroup label="Direct Model">
                          <option value="anthropic/claude-opus-4.6">Claude Opus 4.6</option>
                          <option value="openai/gpt-5.1">GPT 5.1</option>
                          <option value="google/gemini-3-flash-preview">Gemini 3 Flash</option>
                          <option value="deepseek/deepseek-v3.2">DeepSeek v3.2</option>
                          <option value="x-ai/grok-4.1-fast">Grok 4.1 Fast</option>
                        </optgroup>
                      </select>
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                        {aiMode === "auto" ? <Zap className="w-3.5 h-3.5 text-amber-500" /> : aiMode === "ensemble" ? <Sparkles className="w-3.5 h-3.5 text-purple-500" /> : <Brain className="w-3.5 h-3.5 text-blue-500" />}
                      </div>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
                    {lastModelsUsed.length > 0 && !isStreaming && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                        <span>{lastAiModeUsed === "ensemble" ? "Synthesized from" : lastAiModeUsed === "auto" ? "Auto-routed to" : "Sent to"}</span>
                        {lastModelsUsed.map((m) => (
                          <span key={m} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-600 dark:text-slate-400 font-medium">{m}</span>
                        ))}
                      </div>
                    )}
                    {isStreaming && lastModelsUsed.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-500 dark:text-blue-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>{lastAiModeUsed === "ensemble" ? `Consulting ${lastModelsUsed.join(", ")}...` : `Using ${lastModelsUsed[0]}...`}</span>
                      </div>
                    )}
                  </div>
                  {pendingFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3 max-w-3xl mx-auto">
                      {pendingFiles.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200">
                          <Paperclip className="w-3 h-3" />
                          {f.name}
                          <button onClick={() => removePendingFile(i)} className="text-slate-400 hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 items-end max-w-3xl mx-auto">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-file"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-11 w-11 p-0 shrink-0 text-slate-400 hover:text-slate-600"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isStreaming || isUploading}
                      data-testid="btn-attach"
                    >
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                    </Button>
                    <Textarea
                      ref={textareaRef}
                      placeholder={hasMessages ? "Reply or say 'generate' to build the SoW..." : "Paste your messy notes here..."}
                      className="flex-1 resize-none text-sm min-h-[60px] max-h-[400px] overflow-y-auto dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      rows={hasMessages ? 2 : 5}
                      value={input}
                      onChange={(e) => {
                        handleInputChange(e.target.value);
                        const el = e.target;
                        el.style.height = "auto";
                        el.style.height = Math.min(el.scrollHeight, 400) + "px";
                      }}
                      onKeyDown={handleKeyDown}
                      disabled={isStreaming || !canEdit}
                      data-testid="input-chat"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={(!input.trim() && pendingFiles.length === 0) || isStreaming || !canEdit}
                      className="h-11 w-11 p-0 shrink-0"
                      data-testid="btn-send"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                </ErrorBoundary>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <footer className="text-center text-xs text-slate-400 py-2 border-t border-slate-100 bg-white shrink-0 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500">
        <span>{BRANDING.duckyFooter}</span>
        <span className="mx-2">·</span>
        <span>&copy; {new Date().getFullYear()} {BRANDING.parentCompany}</span>
      </footer>
    </div>
  );
}
