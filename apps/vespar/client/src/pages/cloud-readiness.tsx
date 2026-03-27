/**
 * Vespar Cloud Readiness Calculator — Freemium Lead-Gen Tool
 *
 * 10-step infrastructure survey → migration complexity score + TCO estimate
 * No auth required, no data retention. Dark theme, Cavaridge branding.
 */
import { useState, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────

interface SurveyData {
  // Step 1: Current Infrastructure
  serverCount: number;
  avgServerAge: number;
  virtualizationPct: number;
  // Step 2: Workloads
  workloads: string[];
  // Step 3: Network
  bandwidthMbps: number;
  remoteSites: number;
  vpnNeeded: boolean;
  // Step 4: Compliance
  complianceReqs: string[];
  // Step 5: Current Cloud
  currentCloud: string[];
  // Step 6: Data
  dataTB: number;
  growthRatePct: number;
  // Step 7: Business Continuity
  rtoHours: number;
  rpoHours: number;
  backupFrequency: string;
  // Step 8: IT Staff
  itStaffCount: number;
  cloudCertCount: number;
  // Step 9: Budget
  monthlyItSpend: number;
  cloudBudget: number;
  // Step 10: Timeline
  migrationUrgency: string;
}

interface ReadinessResult {
  complexityScore: number;
  readinessLevel: string;
  tcoCurrentAnnual: number;
  tcoCloudYear1: number;
  tcoCloudYear2: number;
  tcoCloudYear3: number;
  savingsYear3: number;
  workloadPriority: Array<{ name: string; complexity: string; priority: number }>;
  riskFactors: string[];
  recommendations: string[];
}

interface LeadData {
  name: string;
  email: string;
  company: string;
  phone: string;
}

const INITIAL_DATA: SurveyData = {
  serverCount: 5, avgServerAge: 4, virtualizationPct: 50,
  workloads: [], bandwidthMbps: 100, remoteSites: 0, vpnNeeded: false,
  complianceReqs: [], currentCloud: [],
  dataTB: 1, growthRatePct: 15,
  rtoHours: 4, rpoHours: 1, backupFrequency: "daily",
  itStaffCount: 2, cloudCertCount: 0,
  monthlyItSpend: 5000, cloudBudget: 4000,
  migrationUrgency: "6mo",
};

const WORKLOAD_OPTIONS = [
  "File & Print", "Email", "LOB Applications", "Database",
  "Web Hosting", "VDI / Remote Desktop", "Backup & DR",
  "Development / CI-CD", "ERP / CRM", "Unified Communications",
];

const COMPLIANCE_OPTIONS = [
  { id: "hipaa", label: "HIPAA" },
  { id: "pci", label: "PCI-DSS" },
  { id: "soc2", label: "SOC 2" },
  { id: "cmmc", label: "CMMC" },
  { id: "none", label: "None" },
];

const CLOUD_OPTIONS = ["Microsoft 365", "Azure", "AWS", "Google Cloud", "None"];

// ─── Scoring Algorithm ──────────────────────────────────────────────────

function calculateReadiness(data: SurveyData): ReadinessResult {
  // Infrastructure Age Score (0-100, higher = more complex)
  const ageScore = Math.min(100, (data.avgServerAge / 10) * 100);
  // Workload complexity
  const complexWorkloads = ["LOB Applications", "Database", "ERP / CRM", "VDI / Remote Desktop"];
  const workloadComplexity = data.workloads.filter(w => complexWorkloads.includes(w)).length;
  const workloadScore = Math.min(100, (data.workloads.length * 8) + (workloadComplexity * 15));
  // Compliance burden
  const complianceScore = data.complianceReqs.includes("none") ? 0 : Math.min(100, data.complianceReqs.length * 25);
  // Data volume
  const dataScore = Math.min(100, (data.dataTB / 50) * 100);
  // Staff readiness (inverse — more certs = less complex)
  const staffRatio = data.itStaffCount > 0 ? data.cloudCertCount / data.itStaffCount : 0;
  const staffScore = Math.max(0, 100 - (staffRatio * 100));
  // Network constraints
  const networkScore = Math.min(100, Math.max(0, 100 - (data.bandwidthMbps / 10)) + (data.remoteSites * 5));

  // Weighted complexity (0-100)
  const complexityScore = Math.round(
    (ageScore * 0.20) +
    (workloadScore * 0.15) +
    (complianceScore * 0.20) +
    (dataScore * 0.15) +
    (staffScore * 0.15) +
    (networkScore * 0.15)
  );

  // Readiness level (inverse of complexity)
  const readiness = 100 - complexityScore;
  let readinessLevel: string;
  if (readiness >= 75) readinessLevel = "Cloud-Ready";
  else if (readiness >= 50) readinessLevel = "Moderate Prep Needed";
  else if (readiness >= 25) readinessLevel = "Significant Prep Needed";
  else readinessLevel = "Major Transformation Required";

  // TCO calculation
  const tcoCurrentAnnual = data.monthlyItSpend * 12;
  let cloudFactor: number;
  if (complexityScore <= 30) cloudFactor = 0.70;
  else if (complexityScore <= 60) cloudFactor = 0.85;
  else cloudFactor = 1.10;

  const migrationCost = tcoCurrentAnnual * (complexityScore / 100) * 0.3;
  const tcoCloudYear1 = Math.round(tcoCurrentAnnual * cloudFactor + migrationCost);
  const tcoCloudYear2 = Math.round(tcoCurrentAnnual * (cloudFactor - 0.10));
  const tcoCloudYear3 = Math.round(tcoCurrentAnnual * (cloudFactor - 0.15));
  const savingsYear3 = (tcoCurrentAnnual * 3) - (tcoCloudYear1 + tcoCloudYear2 + tcoCloudYear3);

  // Workload priority
  const workloadPriority = data.workloads.map((w, i) => ({
    name: w,
    complexity: complexWorkloads.includes(w) ? "High" : "Low",
    priority: complexWorkloads.includes(w) ? i + data.workloads.length : i + 1,
  })).sort((a, b) => a.priority - b.priority);

  // Risk factors
  const riskFactors: string[] = [];
  if (data.avgServerAge > 7) riskFactors.push("Legacy infrastructure (7+ years) may require re-platforming");
  if (data.complianceReqs.length > 1) riskFactors.push("Multiple compliance frameworks increase migration complexity");
  if (data.bandwidthMbps < 100) riskFactors.push("Bandwidth constraints may impact cloud performance");
  if (data.cloudCertCount === 0) riskFactors.push("No cloud-certified staff — training investment needed");
  if (data.dataTB > 10) riskFactors.push("Large data volumes (10+ TB) require phased migration strategy");
  if (data.rtoHours < 1) riskFactors.push("Sub-hour RTO requirement needs premium HA configuration");
  if (workloadComplexity > 2) riskFactors.push("Complex workloads (LOB/DB/ERP) need application-level migration planning");

  // Recommendations
  const recommendations: string[] = [];
  if (data.virtualizationPct < 50) recommendations.push("Increase virtualization before migration — lift-and-shift is easier from VMs");
  if (data.cloudCertCount === 0) recommendations.push("Invest in cloud certifications (AZ-900, AWS CCP) for your IT team");
  if (!data.currentCloud.includes("Microsoft 365") && !data.currentCloud.includes("None")) {
    recommendations.push("Start with M365 migration as a low-risk first step");
  }
  if (data.complianceReqs.includes("hipaa")) recommendations.push("Ensure BAA (Business Associate Agreement) with cloud provider");
  recommendations.push("Conduct a detailed application dependency mapping before migration");
  recommendations.push("Implement a pilot migration with a non-critical workload first");
  if (data.remoteSites > 2) recommendations.push("Evaluate SD-WAN to optimize multi-site cloud connectivity");

  return {
    complexityScore, readinessLevel, tcoCurrentAnnual,
    tcoCloudYear1, tcoCloudYear2, tcoCloudYear3, savingsYear3,
    workloadPriority, riskFactors, recommendations,
  };
}

// ─── Component ──────────────────────────────────────────────────────────

export default function CloudReadiness() {
  const [step, setStep] = useState(0); // 0 = intro, 1-10 = survey, 11 = results
  const [data, setData] = useState<SurveyData>(INITIAL_DATA);
  const [result, setResult] = useState<ReadinessResult | null>(null);
  const [lead, setLead] = useState<LeadData>({ name: "", email: "", company: "", phone: "" });
  const [leadCaptured, setLeadCaptured] = useState(false);

  const update = useCallback(<K extends keyof SurveyData>(key: K, value: SurveyData[K]) => {
    setData(d => ({ ...d, [key]: value }));
  }, []);

  const toggleArray = useCallback((key: "workloads" | "complianceReqs" | "currentCloud", value: string) => {
    setData(d => {
      const arr = d[key] as string[];
      return { ...d, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  }, []);

  function handleComplete() {
    const r = calculateReadiness(data);
    setResult(r);
    setStep(11);
  }

  function handleDownloadCSV() {
    if (!result) return;
    const lines = [
      "Vespar Cloud Readiness Assessment",
      `Generated,${new Date().toISOString().split("T")[0]}`,
      `Company,${lead.company || "N/A"}`,
      "",
      "EXECUTIVE SUMMARY",
      `Migration Complexity Score,${result.complexityScore}/100`,
      `Readiness Level,${result.readinessLevel}`,
      "",
      "TCO ANALYSIS (3-YEAR)",
      "Year,On-Premises,Cloud",
      `Year 1,$${result.tcoCurrentAnnual.toLocaleString()},$${result.tcoCloudYear1.toLocaleString()}`,
      `Year 2,$${result.tcoCurrentAnnual.toLocaleString()},$${result.tcoCloudYear2.toLocaleString()}`,
      `Year 3,$${result.tcoCurrentAnnual.toLocaleString()},$${result.tcoCloudYear3.toLocaleString()}`,
      `3-Year Savings,,$${result.savingsYear3.toLocaleString()}`,
      "",
      "WORKLOAD ASSESSMENT",
      "Workload,Complexity,Priority",
      ...result.workloadPriority.map(w => `${w.name},${w.complexity},${w.priority}`),
      "",
      "RISK FACTORS",
      ...result.riskFactors.map((r, i) => `${i + 1},${r}`),
      "",
      "RECOMMENDATIONS",
      ...result.recommendations.map((r, i) => `${i + 1},${r}`),
      "",
      "Generated by Vespar Cloud Migration Planning — cavaridge.com",
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vespar-cloud-readiness-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const fmt = (n: number) => "$" + n.toLocaleString();
  const pct = (n: number) => Math.round(n) + "%";

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #2E5090 0%, #1a365d 100%)", padding: "24px 0", textAlign: "center" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#fff", margin: 0 }}>VESPAR</h1>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)", marginTop: "4px" }}>Cloud Migration Planning by Cavaridge</p>
      </div>

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 16px" }}>

        {/* ─── Intro ──────────────────────────────────────────────── */}
        {step === 0 && (
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "16px" }}>Cloud Readiness Calculator</h2>
            <p style={{ color: "#94a3b8", lineHeight: 1.6, marginBottom: "24px" }}>
              Answer 10 questions about your current infrastructure to get a personalized migration complexity score,
              3-year TCO estimate, and actionable recommendations. Takes about 3 minutes.
            </p>
            <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "32px" }}>
              No account required. No data stored. Your results are calculated in real-time.
            </p>
            <button onClick={() => setStep(1)} style={btnPrimary}>Start Assessment</button>
          </div>
        )}

        {/* ─── Survey Steps ───────────────────────────────────────── */}
        {step >= 1 && step <= 10 && (
          <div>
            {/* Progress bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
              <span style={{ fontSize: "12px", color: "#94a3b8", whiteSpace: "nowrap" }}>Step {step}/10</span>
              <div style={{ flex: 1, height: "4px", background: "#1e293b", borderRadius: "2px" }}>
                <div style={{ width: `${step * 10}%`, height: "100%", background: "#2E5090", borderRadius: "2px", transition: "width 0.3s" }} />
              </div>
            </div>

            {/* Step 1: Infrastructure */}
            {step === 1 && (
              <StepCard title="Current Infrastructure">
                <NumberInput label="Number of physical/virtual servers" value={data.serverCount} onChange={v => update("serverCount", v)} min={0} max={500} />
                <NumberInput label="Average server age (years)" value={data.avgServerAge} onChange={v => update("avgServerAge", v)} min={0} max={20} />
                <NumberInput label="Virtualization percentage" value={data.virtualizationPct} onChange={v => update("virtualizationPct", v)} min={0} max={100} suffix="%" />
              </StepCard>
            )}

            {/* Step 2: Workloads */}
            {step === 2 && (
              <StepCard title="Workload Types">
                <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "12px" }}>Select all that apply:</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {WORKLOAD_OPTIONS.map(w => (
                    <CheckboxButton key={w} label={w} checked={data.workloads.includes(w)} onChange={() => toggleArray("workloads", w)} />
                  ))}
                </div>
              </StepCard>
            )}

            {/* Step 3: Network */}
            {step === 3 && (
              <StepCard title="Network">
                <NumberInput label="Internet bandwidth (Mbps)" value={data.bandwidthMbps} onChange={v => update("bandwidthMbps", v)} min={1} max={10000} />
                <NumberInput label="Number of remote sites" value={data.remoteSites} onChange={v => update("remoteSites", v)} min={0} max={100} />
                <CheckboxButton label="Site-to-site VPN required" checked={data.vpnNeeded} onChange={() => update("vpnNeeded", !data.vpnNeeded)} />
              </StepCard>
            )}

            {/* Step 4: Compliance */}
            {step === 4 && (
              <StepCard title="Compliance Requirements">
                <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "12px" }}>Which frameworks apply?</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {COMPLIANCE_OPTIONS.map(c => (
                    <CheckboxButton key={c.id} label={c.label} checked={data.complianceReqs.includes(c.id)} onChange={() => toggleArray("complianceReqs", c.id)} />
                  ))}
                </div>
              </StepCard>
            )}

            {/* Step 5: Current Cloud */}
            {step === 5 && (
              <StepCard title="Current Cloud Usage">
                <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "12px" }}>What cloud services do you use today?</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {CLOUD_OPTIONS.map(c => (
                    <CheckboxButton key={c} label={c} checked={data.currentCloud.includes(c)} onChange={() => toggleArray("currentCloud", c)} />
                  ))}
                </div>
              </StepCard>
            )}

            {/* Step 6: Data */}
            {step === 6 && (
              <StepCard title="Data Volume">
                <NumberInput label="Total data (TB)" value={data.dataTB} onChange={v => update("dataTB", v)} min={0} max={1000} />
                <NumberInput label="Annual growth rate" value={data.growthRatePct} onChange={v => update("growthRatePct", v)} min={0} max={100} suffix="%" />
              </StepCard>
            )}

            {/* Step 7: Business Continuity */}
            {step === 7 && (
              <StepCard title="Business Continuity">
                <NumberInput label="Recovery Time Objective (hours)" value={data.rtoHours} onChange={v => update("rtoHours", v)} min={0} max={168} />
                <NumberInput label="Recovery Point Objective (hours)" value={data.rpoHours} onChange={v => update("rpoHours", v)} min={0} max={72} />
                <SelectInput label="Backup frequency" value={data.backupFrequency} onChange={v => update("backupFrequency", v)}
                  options={[{ value: "realtime", label: "Real-time" }, { value: "hourly", label: "Hourly" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]}
                />
              </StepCard>
            )}

            {/* Step 8: IT Staff */}
            {step === 8 && (
              <StepCard title="IT Staff">
                <NumberInput label="IT staff headcount" value={data.itStaffCount} onChange={v => update("itStaffCount", v)} min={0} max={100} />
                <NumberInput label="Cloud certifications held" value={data.cloudCertCount} onChange={v => update("cloudCertCount", v)} min={0} max={50} />
              </StepCard>
            )}

            {/* Step 9: Budget */}
            {step === 9 && (
              <StepCard title="Budget">
                <NumberInput label="Current monthly IT spend" value={data.monthlyItSpend} onChange={v => update("monthlyItSpend", v)} min={0} max={1000000} prefix="$" />
                <NumberInput label="Target monthly cloud budget" value={data.cloudBudget} onChange={v => update("cloudBudget", v)} min={0} max={1000000} prefix="$" />
              </StepCard>
            )}

            {/* Step 10: Timeline */}
            {step === 10 && (
              <StepCard title="Migration Timeline">
                <SelectInput label="Migration urgency" value={data.migrationUrgency} onChange={v => update("migrationUrgency", v)}
                  options={[
                    { value: "3mo", label: "3 months — Urgent" },
                    { value: "6mo", label: "6 months — Standard" },
                    { value: "12mo", label: "12 months — Planned" },
                    { value: "norush", label: "No rush — Evaluating" },
                  ]}
                />
              </StepCard>
            )}

            {/* Navigation */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
              <button onClick={() => setStep(s => s - 1)} style={{ ...btnSecondary, visibility: step === 1 ? "hidden" : "visible" }}>Back</button>
              {step < 10 ? (
                <button onClick={() => setStep(s => s + 1)} style={btnPrimary}>Next</button>
              ) : (
                <button onClick={handleComplete} style={btnPrimary}>Calculate Readiness</button>
              )}
            </div>
          </div>
        )}

        {/* ─── Results ────────────────────────────────────────────── */}
        {step === 11 && result && (
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "24px", textAlign: "center" }}>Your Cloud Readiness Assessment</h2>

            {/* Score Card */}
            <div style={card}>
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div style={{ fontSize: "56px", fontWeight: 700, color: scoreColor(100 - result.complexityScore) }}>
                  {100 - result.complexityScore}
                </div>
                <div style={{ fontSize: "14px", color: "#94a3b8" }}>Readiness Score (out of 100)</div>
                <div style={{ marginTop: "8px", display: "inline-block", padding: "4px 16px", borderRadius: "999px", fontSize: "13px", fontWeight: 600, background: scoreColor(100 - result.complexityScore) + "22", color: scoreColor(100 - result.complexityScore) }}>
                  {result.readinessLevel}
                </div>
              </div>
              <div style={{ height: "8px", background: "#1e293b", borderRadius: "4px" }}>
                <div style={{ width: `${100 - result.complexityScore}%`, height: "100%", borderRadius: "4px", background: `linear-gradient(90deg, ${scoreColor(100 - result.complexityScore)}, ${scoreColor(100 - result.complexityScore)}88)`, transition: "width 0.5s" }} />
              </div>
            </div>

            {/* TCO Comparison */}
            <div style={card}>
              <h3 style={cardTitle}>3-Year TCO Comparison</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    <th style={{ textAlign: "left", padding: "8px 0", color: "#94a3b8" }}>Year</th>
                    <th style={{ textAlign: "right", padding: "8px 0", color: "#94a3b8" }}>On-Premises</th>
                    <th style={{ textAlign: "right", padding: "8px 0", color: "#94a3b8" }}>Cloud</th>
                    <th style={{ textAlign: "right", padding: "8px 0", color: "#94a3b8" }}>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { year: "Year 1", onprem: result.tcoCurrentAnnual, cloud: result.tcoCloudYear1 },
                    { year: "Year 2", onprem: result.tcoCurrentAnnual, cloud: result.tcoCloudYear2 },
                    { year: "Year 3", onprem: result.tcoCurrentAnnual, cloud: result.tcoCloudYear3 },
                  ].map(row => (
                    <tr key={row.year} style={{ borderBottom: "1px solid #1e293b" }}>
                      <td style={{ padding: "10px 0" }}>{row.year}</td>
                      <td style={{ textAlign: "right", padding: "10px 0", fontFamily: "monospace" }}>{fmt(row.onprem)}</td>
                      <td style={{ textAlign: "right", padding: "10px 0", fontFamily: "monospace" }}>{fmt(row.cloud)}</td>
                      <td style={{ textAlign: "right", padding: "10px 0", fontFamily: "monospace", color: row.onprem - row.cloud > 0 ? "#22c55e" : "#ef4444" }}>
                        {row.onprem - row.cloud > 0 ? "-" : "+"}{fmt(Math.abs(row.onprem - row.cloud))}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700 }}>
                    <td style={{ padding: "10px 0" }}>3-Year Net</td>
                    <td colSpan={2} />
                    <td style={{ textAlign: "right", padding: "10px 0", fontFamily: "monospace", color: result.savingsYear3 > 0 ? "#22c55e" : "#ef4444" }}>
                      {result.savingsYear3 > 0 ? "Save " : "Cost +"}{fmt(Math.abs(result.savingsYear3))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Workload Priority */}
            {result.workloadPriority.length > 0 && (
              <div style={card}>
                <h3 style={cardTitle}>Workload Migration Priority</h3>
                {result.workloadPriority.map((w, i) => (
                  <div key={w.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < result.workloadPriority.length - 1 ? "1px solid #1e293b" : "none" }}>
                    <span>{w.name}</span>
                    <span style={{ fontSize: "12px", padding: "2px 10px", borderRadius: "999px", background: w.complexity === "High" ? "#ef444422" : "#22c55e22", color: w.complexity === "High" ? "#ef4444" : "#22c55e" }}>
                      {w.complexity}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Risk Factors */}
            {result.riskFactors.length > 0 && (
              <div style={card}>
                <h3 style={cardTitle}>Risk Factors</h3>
                {result.riskFactors.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: "8px", padding: "8px 0", borderBottom: i < result.riskFactors.length - 1 ? "1px solid #1e293b" : "none" }}>
                    <span style={{ color: "#f59e0b", fontSize: "14px" }}>⚠</span>
                    <span style={{ fontSize: "14px", color: "#cbd5e1" }}>{r}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations */}
            <div style={card}>
              <h3 style={cardTitle}>Recommendations</h3>
              {result.recommendations.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", padding: "8px 0", borderBottom: i < result.recommendations.length - 1 ? "1px solid #1e293b" : "none" }}>
                  <span style={{ color: "#2E5090", fontWeight: 700, fontSize: "14px" }}>{i + 1}.</span>
                  <span style={{ fontSize: "14px", color: "#cbd5e1" }}>{r}</span>
                </div>
              ))}
            </div>

            {/* Lead Capture + Download */}
            <div style={card}>
              <h3 style={cardTitle}>Get Your Full Report</h3>
              {!leadCaptured ? (
                <div>
                  <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "16px" }}>Enter your details to download the complete assessment report.</p>
                  <div style={{ display: "grid", gap: "10px" }}>
                    <input style={inputStyle} placeholder="Full Name *" value={lead.name} onChange={e => setLead(l => ({ ...l, name: e.target.value }))} />
                    <input style={inputStyle} placeholder="Work Email *" type="email" value={lead.email} onChange={e => setLead(l => ({ ...l, email: e.target.value }))} />
                    <input style={inputStyle} placeholder="Company Name *" value={lead.company} onChange={e => setLead(l => ({ ...l, company: e.target.value }))} />
                    <input style={inputStyle} placeholder="Phone (optional)" value={lead.phone} onChange={e => setLead(l => ({ ...l, phone: e.target.value }))} />
                  </div>
                  <button onClick={() => { if (lead.name && lead.email && lead.company) { setLeadCaptured(true); handleDownloadCSV(); } }}
                    disabled={!lead.name || !lead.email || !lead.company}
                    style={{ ...btnPrimary, marginTop: "16px", width: "100%", opacity: lead.name && lead.email && lead.company ? 1 : 0.5 }}>
                    Download Report
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#22c55e", marginBottom: "12px" }}>Report downloaded!</p>
                  <button onClick={handleDownloadCSV} style={btnSecondary}>Download Again</button>
                </div>
              )}
            </div>

            {/* CTA */}
            <div style={{ ...card, textAlign: "center", background: "linear-gradient(135deg, #2E5090 0%, #1a365d 100%)", border: "none" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>Ready for a Full Migration Plan?</h3>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)", marginBottom: "16px" }}>
                Vespar provides detailed workload-level migration plans, dependency mapping, automated runbooks, and cost optimization.
              </p>
              <a href="/" style={{ ...btnPrimary, display: "inline-block", textDecoration: "none", background: "#fff", color: "#2E5090" }}>
                Explore Vespar →
              </a>
            </div>

            <button onClick={() => { setStep(0); setResult(null); setLeadCaptured(false); }} style={{ ...btnSecondary, width: "100%", marginTop: "16px" }}>
              Start Over
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: "48px", padding: "16px", borderTop: "1px solid #1e293b" }}>
          <p style={{ fontSize: "11px", color: "#475569" }}>Powered by Ducky Intelligence. © {new Date().getFullYear()} Cavaridge, LLC</p>
          <p style={{ fontSize: "10px", color: "#334155", marginTop: "4px" }}>
            Results are budgetary estimates for planning purposes only. Actual costs depend on workload specifics, provider pricing, and implementation approach.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Sub-Components ──────────────────────────────────────────────

function StepCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={card}>
      <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>{title}</h3>
      <div style={{ display: "grid", gap: "14px" }}>{children}</div>
    </div>
  );
}

function NumberInput({ label, value, onChange, min, max, prefix, suffix }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; prefix?: string; suffix?: string;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "6px" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {prefix && <span style={{ color: "#64748b" }}>{prefix}</span>}
        <input type="number" value={value} onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
          style={inputStyle} min={min} max={max} />
        {suffix && <span style={{ color: "#64748b" }}>{suffix}</span>}
      </div>
    </div>
  );
}

function SelectInput({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "6px" }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function CheckboxButton({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{
      display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px",
      background: checked ? "#2E509022" : "#1e293b", border: `1px solid ${checked ? "#2E5090" : "#334155"}`,
      borderRadius: "8px", color: checked ? "#93c5fd" : "#94a3b8", fontSize: "13px",
      cursor: "pointer", textAlign: "left", transition: "all 0.15s",
    }}>
      <span style={{ width: "16px", height: "16px", borderRadius: "4px", border: `2px solid ${checked ? "#2E5090" : "#475569"}`,
        background: checked ? "#2E5090" : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "10px", color: "#fff", flexShrink: 0 }}>
        {checked ? "✓" : ""}
      </span>
      {label}
    </button>
  );
}

function scoreColor(score: number): string {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  if (score >= 25) return "#f97316";
  return "#ef4444";
}

// ─── Styles ─────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#1e293b", border: "1px solid #334155", borderRadius: "12px",
  padding: "24px", marginBottom: "16px",
};

const cardTitle: React.CSSProperties = {
  fontSize: "16px", fontWeight: 600, marginBottom: "16px", color: "#e2e8f0",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "#0f172a", border: "1px solid #334155",
  borderRadius: "8px", color: "#e2e8f0", fontSize: "14px", outline: "none",
};

const btnPrimary: React.CSSProperties = {
  padding: "12px 28px", background: "#2E5090", color: "#fff", border: "none",
  borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "12px 28px", background: "#1e293b", color: "#94a3b8", border: "1px solid #334155",
  borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer",
};
