/**
 * Midas Security Score Widget — Freemium Lead-Gen Tool
 *
 * Input Microsoft Secure Score + compensating controls → Cavaridge Adjusted Score
 * No auth required, no data retention. Dark theme, Cavaridge branding.
 */
import { useState, useMemo } from "react";

// ─── Types ──────────────────────────────────────────────────────────────

interface CompensatingControl {
  id: string;
  label: string;
  description: string;
  bonus: number;
  category: string;
}

interface ScoreResult {
  baseScore: number;
  adjustedScore: number;
  rating: string;
  ratingColor: string;
  breakdown: {
    msSecureScore: number;
    msWeight: number;
    gwsHealth: number | null;
    gwsWeight: number;
    compensatingBonus: number;
    activeControls: string[];
  };
  gaps: Array<{ area: string; impact: string; recommendation: string }>;
  peerComparison: string;
}

interface LeadData {
  name: string;
  email: string;
  company: string;
}

// ─── Constants ──────────────────────────────────────────────────────────

const COMPENSATING_CONTROLS: CompensatingControl[] = [
  { id: "edr", label: "SentinelOne / CrowdStrike EDR", description: "Endpoint detection and response deployed", bonus: 3, category: "Endpoint" },
  { id: "mfa", label: "Duo / Entra ID MFA", description: "Multi-factor authentication enforced", bonus: 3, category: "Identity" },
  { id: "email", label: "Proofpoint / Mimecast Email Security", description: "Advanced email threat protection", bonus: 2, category: "Email" },
  { id: "dns", label: "DNS Filtering (Cloudflare / Cisco Umbrella)", description: "DNS-level threat blocking", bonus: 2, category: "Network" },
  { id: "siem", label: "SIEM / SOC Monitoring", description: "Security operations center or SIEM", bonus: 2, category: "Monitoring" },
  { id: "backup", label: "Backup Solution (Datto / Veeam)", description: "Tested backup and disaster recovery", bonus: 2, category: "Resilience" },
  { id: "training", label: "Security Awareness Training", description: "Regular phishing simulation and training", bonus: 1, category: "People" },
  { id: "vulnscan", label: "Vulnerability Scanning", description: "Regular vulnerability assessments", bonus: 1, category: "Assessment" },
  { id: "patching", label: "Patch Management Automation", description: "Automated OS and application patching", bonus: 1, category: "Operations" },
];

const MAX_BONUS = 5;

// ─── Scoring ────────────────────────────────────────────────────────────

function calculateScore(
  msScore: number,
  gwsScore: number | null,
  selectedControls: string[],
): ScoreResult {
  // Base score calculation
  let baseScore: number;
  let msWeight: number;
  let gwsWeight: number;

  if (gwsScore !== null) {
    msWeight = 0.6;
    gwsWeight = 0.4;
    baseScore = (msScore * msWeight) + (gwsScore * gwsWeight);
  } else {
    msWeight = 1.0;
    gwsWeight = 0;
    baseScore = msScore;
  }

  // Compensating controls bonus
  const activeControls = COMPENSATING_CONTROLS.filter(c => selectedControls.includes(c.id));
  const rawBonus = activeControls.reduce((sum, c) => sum + c.bonus, 0);
  const compensatingBonus = Math.min(MAX_BONUS, rawBonus);

  const adjustedScore = Math.min(100, Math.round(baseScore + compensatingBonus));

  // Rating
  let rating: string;
  let ratingColor: string;
  if (adjustedScore >= 80) { rating = "Strong"; ratingColor = "#22c55e"; }
  else if (adjustedScore >= 65) { rating = "Good"; ratingColor = "#3b82f6"; }
  else if (adjustedScore >= 50) { rating = "Needs Improvement"; ratingColor = "#f59e0b"; }
  else { rating = "At Risk"; ratingColor = "#ef4444"; }

  // Gap analysis
  const gaps: ScoreResult["gaps"] = [];
  if (!selectedControls.includes("edr")) {
    gaps.push({ area: "Endpoint Protection", impact: "High", recommendation: "Deploy EDR (SentinelOne or CrowdStrike) across all endpoints" });
  }
  if (!selectedControls.includes("mfa")) {
    gaps.push({ area: "Identity & Access", impact: "Critical", recommendation: "Enforce MFA for all users — single biggest security improvement" });
  }
  if (!selectedControls.includes("email")) {
    gaps.push({ area: "Email Security", impact: "High", recommendation: "Add advanced email security (Proofpoint/Mimecast) — email is #1 attack vector" });
  }
  if (!selectedControls.includes("dns")) {
    gaps.push({ area: "Network Security", impact: "Medium", recommendation: "Implement DNS filtering to block malicious domains at the network level" });
  }
  if (!selectedControls.includes("backup")) {
    gaps.push({ area: "Business Continuity", impact: "High", recommendation: "Deploy tested backup/DR solution — ransomware recovery depends on it" });
  }
  if (!selectedControls.includes("training")) {
    gaps.push({ area: "Human Factor", impact: "Medium", recommendation: "Start security awareness training with phishing simulations" });
  }
  if (!selectedControls.includes("patching")) {
    gaps.push({ area: "Vulnerability Management", impact: "Medium", recommendation: "Automate patch management to reduce exposure window" });
  }
  if (msScore < 50) {
    gaps.push({ area: "Microsoft 365 Configuration", impact: "High", recommendation: "Review M365 security defaults — many quick wins available in Secure Score" });
  }

  // Peer comparison
  let peerComparison: string;
  if (adjustedScore >= 75) {
    peerComparison = `Your adjusted score of ${adjustedScore} places you in the top 25% of MSP-managed organizations. Strong security posture.`;
  } else if (adjustedScore >= 60) {
    peerComparison = `Your adjusted score of ${adjustedScore} is near the average for MSP-managed organizations (median: 62). Room for improvement.`;
  } else {
    peerComparison = `Your adjusted score of ${adjustedScore} is below the average for MSP-managed organizations (median: 62). Immediate action recommended.`;
  }

  return {
    baseScore: Math.round(baseScore),
    adjustedScore,
    rating,
    ratingColor,
    breakdown: {
      msSecureScore: msScore,
      msWeight,
      gwsHealth: gwsScore,
      gwsWeight,
      compensatingBonus,
      activeControls: activeControls.map(c => c.label),
    },
    gaps,
    peerComparison,
  };
}

// ─── Component ──────────────────────────────────────────────────────────

export default function SecurityCheck() {
  const [msScore, setMsScore] = useState(55);
  const [gwsEnabled, setGwsEnabled] = useState(false);
  const [gwsScore, setGwsScore] = useState(50);
  const [selectedControls, setSelectedControls] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [lead, setLead] = useState<LeadData>({ name: "", email: "", company: "" });
  const [leadCaptured, setLeadCaptured] = useState(false);

  const toggleControl = (id: string) => {
    setSelectedControls(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const result = useMemo(() =>
    calculateScore(msScore, gwsEnabled ? gwsScore : null, selectedControls),
    [msScore, gwsEnabled, gwsScore, selectedControls]
  );

  const totalBonus = COMPENSATING_CONTROLS.filter(c => selectedControls.includes(c.id)).reduce((s, c) => s + c.bonus, 0);

  function handleDownload() {
    const lines = [
      "Cavaridge Adjusted Security Score Report",
      `Generated,${new Date().toISOString().split("T")[0]}`,
      `Company,${lead.company || "N/A"}`,
      "",
      "SCORE SUMMARY",
      `Microsoft Secure Score,${msScore}/100`,
      gwsEnabled ? `Google Workspace Health,${gwsScore}/100` : "Google Workspace Health,Not configured",
      `Base Score,${result.baseScore}/100`,
      `Compensating Controls Bonus,+${result.breakdown.compensatingBonus}`,
      `Cavaridge Adjusted Score,${result.adjustedScore}/100`,
      `Rating,${result.rating}`,
      "",
      "ACTIVE COMPENSATING CONTROLS",
      ...result.breakdown.activeControls.map(c => `,${c}`),
      "",
      "GAP ANALYSIS",
      "Area,Impact,Recommendation",
      ...result.gaps.map(g => `${g.area},${g.impact},"${g.recommendation}"`),
      "",
      "PEER COMPARISON",
      `,"${result.peerComparison}"`,
      "",
      "Generated by Midas IT Roadmap Platform — cavaridge.com",
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cavaridge-security-score-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #2E5090 0%, #1a365d 100%)", padding: "24px 0", textAlign: "center" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#fff", margin: 0 }}>MIDAS</h1>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)", marginTop: "4px" }}>IT Roadmap & QBR Platform by Cavaridge</p>
      </div>

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 16px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px", textAlign: "center" }}>Cavaridge Adjusted Security Score</h2>
        <p style={{ fontSize: "14px", color: "#94a3b8", textAlign: "center", marginBottom: "32px" }}>
          Microsoft Secure Score alone penalizes organizations with third-party security tools.
          The Cavaridge Adjusted Score gives credit for compensating controls.
        </p>

        {/* ─── Input Section ─────────────────────────────────────── */}

        {/* Microsoft Secure Score */}
        <div style={card}>
          <h3 style={cardTitle}>Microsoft Secure Score</h3>
          <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "12px" }}>
            Find this at <span style={{ color: "#93c5fd" }}>security.microsoft.com → Secure Score</span>
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <input type="range" min={0} max={100} value={msScore} onChange={e => setMsScore(Number(e.target.value))}
              style={{ flex: 1, accentColor: "#2E5090" }} />
            <div style={{ minWidth: "56px", textAlign: "center" }}>
              <span style={{ fontSize: "28px", fontWeight: 700, color: scoreColor(msScore) }}>{msScore}</span>
              <span style={{ fontSize: "12px", color: "#64748b" }}>/100</span>
            </div>
          </div>
          <div style={{ marginTop: "8px", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#475569" }}>
            <span>0 — Critical</span><span>50 — Average</span><span>100 — Excellent</span>
          </div>
        </div>

        {/* Google Workspace (Optional) */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: gwsEnabled ? "16px" : "0" }}>
            <div>
              <h3 style={{ ...cardTitle, marginBottom: "4px" }}>Google Workspace Security Health</h3>
              <p style={{ fontSize: "12px", color: "#64748b" }}>Optional — skip if not using Google Workspace</p>
            </div>
            <button onClick={() => setGwsEnabled(!gwsEnabled)} style={{
              width: "48px", height: "26px", borderRadius: "13px", border: "none", cursor: "pointer",
              background: gwsEnabled ? "#2E5090" : "#334155", position: "relative", transition: "background 0.2s",
            }}>
              <div style={{
                width: "20px", height: "20px", borderRadius: "50%", background: "#fff",
                position: "absolute", top: "3px", left: gwsEnabled ? "25px" : "3px", transition: "left 0.2s",
              }} />
            </button>
          </div>
          {gwsEnabled && (
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <input type="range" min={0} max={100} value={gwsScore} onChange={e => setGwsScore(Number(e.target.value))}
                style={{ flex: 1, accentColor: "#2E5090" }} />
              <div style={{ minWidth: "56px", textAlign: "center" }}>
                <span style={{ fontSize: "28px", fontWeight: 700, color: scoreColor(gwsScore) }}>{gwsScore}</span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>/100</span>
              </div>
            </div>
          )}
        </div>

        {/* Compensating Controls */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ ...cardTitle, marginBottom: "4px" }}>Compensating Controls</h3>
              <p style={{ fontSize: "12px", color: "#64748b" }}>Check all security tools deployed in your environment</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "20px", fontWeight: 700, color: "#22c55e" }}>+{Math.min(MAX_BONUS, totalBonus)}</span>
              <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>of +{MAX_BONUS} max</span>
            </div>
          </div>
          <div style={{ display: "grid", gap: "8px" }}>
            {COMPENSATING_CONTROLS.map(control => (
              <button key={control.id} onClick={() => toggleControl(control.id)} style={{
                display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px",
                background: selectedControls.includes(control.id) ? "#2E509022" : "#0f172a",
                border: `1px solid ${selectedControls.includes(control.id) ? "#2E5090" : "#1e293b"}`,
                borderRadius: "8px", cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                color: "#e2e8f0", width: "100%",
              }}>
                <span style={{
                  width: "20px", height: "20px", borderRadius: "4px",
                  border: `2px solid ${selectedControls.includes(control.id) ? "#2E5090" : "#475569"}`,
                  background: selectedControls.includes(control.id) ? "#2E5090" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px", color: "#fff", flexShrink: 0,
                }}>
                  {selectedControls.includes(control.id) ? "✓" : ""}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: 500 }}>{control.label}</div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>{control.description}</div>
                </div>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#22c55e" }}>+{control.bonus}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Calculate Button */}
        {!showResults && (
          <button onClick={() => setShowResults(true)} style={{ ...btnPrimary, width: "100%", padding: "14px", fontSize: "16px" }}>
            Calculate Adjusted Score
          </button>
        )}

        {/* ─── Results Section ────────────────────────────────────── */}
        {showResults && (
          <div>
            {/* Score Display */}
            <div style={{ ...card, textAlign: "center" }}>
              <div style={{ fontSize: "64px", fontWeight: 700, color: result.ratingColor }}>
                {result.adjustedScore}
              </div>
              <div style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "8px" }}>Cavaridge Adjusted Score</div>
              <div style={{ display: "inline-block", padding: "4px 20px", borderRadius: "999px", fontSize: "14px", fontWeight: 600, background: result.ratingColor + "22", color: result.ratingColor }}>
                {result.rating}
              </div>

              {/* Score bar */}
              <div style={{ marginTop: "20px", height: "8px", background: "#1e293b", borderRadius: "4px" }}>
                <div style={{ width: `${result.adjustedScore}%`, height: "100%", borderRadius: "4px", background: `linear-gradient(90deg, ${result.ratingColor}, ${result.ratingColor}88)`, transition: "width 0.5s" }} />
              </div>

              {/* Breakdown */}
              <div style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>MS Secure Score</div>
                  <div style={{ fontSize: "18px", fontWeight: 600 }}>{msScore}</div>
                  <div style={{ fontSize: "10px", color: "#475569" }}>× {(result.breakdown.msWeight * 100).toFixed(0)}%</div>
                </div>
                {gwsEnabled && (
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>GWS Health</div>
                    <div style={{ fontSize: "18px", fontWeight: 600 }}>{gwsScore}</div>
                    <div style={{ fontSize: "10px", color: "#475569" }}>× {(result.breakdown.gwsWeight * 100).toFixed(0)}%</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>Controls Bonus</div>
                  <div style={{ fontSize: "18px", fontWeight: 600, color: "#22c55e" }}>+{result.breakdown.compensatingBonus}</div>
                  <div style={{ fontSize: "10px", color: "#475569" }}>{result.breakdown.activeControls.length} active</div>
                </div>
              </div>
            </div>

            {/* Peer Comparison */}
            <div style={{ ...card, background: "#1e293b", borderColor: "#334155" }}>
              <h3 style={{ ...cardTitle, fontSize: "14px" }}>Peer Comparison</h3>
              <p style={{ fontSize: "14px", color: "#cbd5e1", lineHeight: 1.6 }}>{result.peerComparison}</p>
            </div>

            {/* Gap Analysis */}
            {result.gaps.length > 0 && (
              <div style={card}>
                <h3 style={cardTitle}>Gap Analysis ({result.gaps.length} areas)</h3>
                {result.gaps.map((gap, i) => (
                  <div key={i} style={{ padding: "12px 0", borderBottom: i < result.gaps.length - 1 ? "1px solid #1e293b" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 600, fontSize: "14px" }}>{gap.area}</span>
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "999px",
                        background: gap.impact === "Critical" ? "#ef444422" : gap.impact === "High" ? "#f5920b22" : "#3b82f622",
                        color: gap.impact === "Critical" ? "#ef4444" : gap.impact === "High" ? "#f59e0b" : "#3b82f6",
                      }}>{gap.impact}</span>
                    </div>
                    <p style={{ fontSize: "13px", color: "#94a3b8" }}>{gap.recommendation}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Lead Capture + Download */}
            <div style={card}>
              <h3 style={cardTitle}>Download Your Score Report</h3>
              {!leadCaptured ? (
                <div>
                  <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "16px" }}>Enter your details to download.</p>
                  <div style={{ display: "grid", gap: "10px" }}>
                    <input style={inputStyle} placeholder="Full Name *" value={lead.name} onChange={e => setLead(l => ({ ...l, name: e.target.value }))} />
                    <input style={inputStyle} placeholder="Work Email *" type="email" value={lead.email} onChange={e => setLead(l => ({ ...l, email: e.target.value }))} />
                    <input style={inputStyle} placeholder="Company Name *" value={lead.company} onChange={e => setLead(l => ({ ...l, company: e.target.value }))} />
                  </div>
                  <button onClick={() => { if (lead.name && lead.email && lead.company) { setLeadCaptured(true); handleDownload(); } }}
                    disabled={!lead.name || !lead.email || !lead.company}
                    style={{ ...btnPrimary, marginTop: "16px", width: "100%", opacity: lead.name && lead.email && lead.company ? 1 : 0.5 }}>
                    Download Report
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#22c55e", marginBottom: "12px" }}>Report downloaded!</p>
                  <button onClick={handleDownload} style={btnSecondary}>Download Again</button>
                </div>
              )}
            </div>

            {/* CTA */}
            <div style={{ ...card, textAlign: "center", background: "linear-gradient(135deg, #2E5090 0%, #1a365d 100%)", border: "none" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>Want Continuous Security Monitoring?</h3>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)", marginBottom: "16px" }}>
                Midas tracks your security posture over time, generates QBR-ready reports, and integrates with AEGIS
                for real-time browser security and SaaS discovery.
              </p>
              <a href="/" style={{ ...btnPrimary, display: "inline-block", textDecoration: "none", background: "#fff", color: "#2E5090" }}>
                Explore Midas →
              </a>
            </div>

            {/* Recalculate */}
            <button onClick={() => setShowResults(false)} style={{ ...btnSecondary, width: "100%", marginTop: "16px" }}>
              Adjust Inputs & Recalculate
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: "48px", padding: "16px", borderTop: "1px solid #1e293b" }}>
          <p style={{ fontSize: "11px", color: "#475569" }}>Powered by Ducky Intelligence. © {new Date().getFullYear()} Cavaridge, LLC</p>
          <p style={{ fontSize: "10px", color: "#334155", marginTop: "4px" }}>
            The Cavaridge Adjusted Score is a security posture indicator for planning purposes. It is not a compliance certification.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 65) return "#3b82f6";
  if (score >= 50) return "#f59e0b";
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
