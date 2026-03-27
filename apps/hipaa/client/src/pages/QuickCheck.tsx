import { useState, useMemo } from "react";

// =============================================================================
// Types & Constants
// =============================================================================

interface Question {
  id: number;
  text: string;
  reference: string;
  category: QuestionCategory;
}

type QuestionCategory =
  | "Risk Analysis"
  | "Workforce Security"
  | "Information Access"
  | "Security Awareness"
  | "Physical Safeguards"
  | "Technical Safeguards"
  | "Breach Notification";

type SafeguardGroup = "Administrative" | "Physical" | "Technical" | "Breach Notification";

const CATEGORY_TO_GROUP: Record<QuestionCategory, SafeguardGroup> = {
  "Risk Analysis": "Administrative",
  "Workforce Security": "Administrative",
  "Information Access": "Administrative",
  "Security Awareness": "Administrative",
  "Physical Safeguards": "Physical",
  "Technical Safeguards": "Technical",
  "Breach Notification": "Breach Notification",
};

const GROUP_WEIGHTS: Record<SafeguardGroup, number> = {
  "Technical": 35,
  "Administrative": 40,
  "Physical": 15,
  "Breach Notification": 10,
};

const GROUP_QUESTION_COUNTS: Record<SafeguardGroup, number> = {
  "Administrative": 8,
  "Physical": 4,
  "Technical": 6,
  "Breach Notification": 2,
};

const QUESTIONS: Question[] = [
  // Administrative Safeguards — Risk Analysis (3)
  {
    id: 1,
    text: "Has your organization conducted a comprehensive risk analysis within the past 12 months?",
    reference: "45 CFR \u00A7164.308(a)(1)(ii)(A)",
    category: "Risk Analysis",
  },
  {
    id: 2,
    text: "Do you have documented policies and procedures for protecting ePHI?",
    reference: "45 CFR \u00A7164.308(a)(1)(ii)(B)",
    category: "Risk Analysis",
  },
  {
    id: 3,
    text: "Is there a designated HIPAA Security Officer?",
    reference: "45 CFR \u00A7164.308(a)(2)",
    category: "Risk Analysis",
  },
  // Administrative Safeguards — Workforce Security (3)
  {
    id: 4,
    text: "Do all workforce members receive HIPAA security training upon hire and annually?",
    reference: "45 CFR \u00A7164.308(a)(5)",
    category: "Workforce Security",
  },
  {
    id: 5,
    text: "Do you have procedures for granting and revoking access to ePHI?",
    reference: "45 CFR \u00A7164.308(a)(4)",
    category: "Workforce Security",
  },
  {
    id: 6,
    text: "Do you have an incident response plan for security breaches?",
    reference: "45 CFR \u00A7164.308(a)(6)",
    category: "Workforce Security",
  },
  // Administrative Safeguards — Information Access (2)
  {
    id: 7,
    text: "Are Business Associate Agreements in place with all vendors who handle ePHI?",
    reference: "45 CFR \u00A7164.308(b)",
    category: "Information Access",
  },
  {
    id: 8,
    text: "Do you perform periodic reviews of system activity (audit logs)?",
    reference: "45 CFR \u00A7164.308(a)(1)(ii)(D)",
    category: "Information Access",
  },
  // Physical Safeguards (3 + 1 = 4 mapped to Physical)
  {
    id: 9,
    text: "Are facilities with ePHI access physically secured?",
    reference: "45 CFR \u00A7164.310(a)(1)",
    category: "Physical Safeguards",
  },
  {
    id: 10,
    text: "Are there policies for workstation use and positioning?",
    reference: "45 CFR \u00A7164.310(b)",
    category: "Physical Safeguards",
  },
  {
    id: 11,
    text: "Do you have device and media disposal procedures?",
    reference: "45 CFR \u00A7164.310(d)(2)",
    category: "Physical Safeguards",
  },
  {
    id: 12,
    text: "Do you maintain records of hardware/equipment movements?",
    reference: "45 CFR \u00A7164.310(d)(1)",
    category: "Physical Safeguards",
  },
  // Technical Safeguards (6)
  {
    id: 13,
    text: "Do all users have unique user IDs for system access?",
    reference: "45 CFR \u00A7164.312(a)(2)(i)",
    category: "Technical Safeguards",
  },
  {
    id: 14,
    text: "Is ePHI encrypted at rest?",
    reference: "45 CFR \u00A7164.312(a)(2)(iv)",
    category: "Technical Safeguards",
  },
  {
    id: 15,
    text: "Is ePHI encrypted in transit?",
    reference: "45 CFR \u00A7164.312(e)(2)(ii)",
    category: "Technical Safeguards",
  },
  {
    id: 16,
    text: "Do you have automatic logoff for inactive sessions?",
    reference: "45 CFR \u00A7164.312(a)(2)(iii)",
    category: "Technical Safeguards",
  },
  {
    id: 17,
    text: "Do you use multi-factor authentication for remote access?",
    reference: "45 CFR \u00A7164.312(d)",
    category: "Technical Safeguards",
  },
  {
    id: 18,
    text: "Are audit controls in place to record access to ePHI?",
    reference: "45 CFR \u00A7164.312(b)",
    category: "Technical Safeguards",
  },
  // Breach Notification (2)
  {
    id: 19,
    text: "Do you have a breach notification procedure that meets the 60-day reporting requirement?",
    reference: "45 CFR \u00A7164.404",
    category: "Breach Notification",
  },
  {
    id: 20,
    text: "Do you maintain a breach log for incidents affecting fewer than 500 individuals?",
    reference: "45 CFR \u00A7164.408",
    category: "Breach Notification",
  },
];

const RISK_LEVELS = [
  { label: "Critical", min: 0, max: 40, color: "#ef4444", bg: "bg-red-500/20", border: "border-red-500/30", text: "text-red-400" },
  { label: "High", min: 41, max: 60, color: "#f97316", bg: "bg-orange-500/20", border: "border-orange-500/30", text: "text-orange-400" },
  { label: "Medium", min: 61, max: 80, color: "#eab308", bg: "bg-yellow-500/20", border: "border-yellow-500/30", text: "text-yellow-400" },
  { label: "Low", min: 81, max: 100, color: "#22c55e", bg: "bg-green-500/20", border: "border-green-500/30", text: "text-green-400" },
] as const;

function getRiskLevel(score: number) {
  return RISK_LEVELS.find(r => score >= r.min && score <= r.max) ?? RISK_LEVELS[0];
}

// =============================================================================
// Score Calculation
// =============================================================================

function calculateScores(answers: Record<number, boolean>) {
  const groupYes: Record<SafeguardGroup, number> = {
    Administrative: 0,
    Physical: 0,
    Technical: 0,
    "Breach Notification": 0,
  };

  for (const q of QUESTIONS) {
    const group = CATEGORY_TO_GROUP[q.category];
    if (answers[q.id] === true) {
      groupYes[group]++;
    }
  }

  const groupScores: Record<SafeguardGroup, number> = {
    Administrative: 0,
    Physical: 0,
    Technical: 0,
    "Breach Notification": 0,
  };

  for (const group of Object.keys(groupYes) as SafeguardGroup[]) {
    const total = GROUP_QUESTION_COUNTS[group];
    groupScores[group] = total > 0 ? Math.round((groupYes[group] / total) * 100) : 0;
  }

  // Weighted overall
  let overall = 0;
  for (const group of Object.keys(groupScores) as SafeguardGroup[]) {
    overall += (groupScores[group] / 100) * GROUP_WEIGHTS[group];
  }
  overall = Math.round(overall);

  // Gaps: questions answered "no"
  const gaps = QUESTIONS.filter(q => answers[q.id] === false);

  return { overall, groupScores, gaps };
}

// =============================================================================
// Recommendations
// =============================================================================

function getRecommendations(gaps: Question[]): string[] {
  const recs: string[] = [];
  const categories = new Set(gaps.map(g => CATEGORY_TO_GROUP[g.category]));

  if (categories.has("Technical")) {
    recs.push("Prioritize encryption of ePHI at rest and in transit -- technical safeguards carry the highest compliance weight.");
    recs.push("Implement multi-factor authentication for all remote access to systems containing ePHI.");
  }
  if (categories.has("Administrative")) {
    recs.push("Conduct a comprehensive HIPAA risk analysis immediately if one has not been completed in the past 12 months.");
    recs.push("Ensure all workforce members receive documented HIPAA security awareness training upon hire and at least annually.");
  }
  if (categories.has("Physical")) {
    recs.push("Review and document physical access controls for all areas where ePHI is accessed or stored.");
    recs.push("Establish device and media disposal procedures with documented chain-of-custody records.");
  }
  if (categories.has("Breach Notification")) {
    recs.push("Develop a documented breach notification procedure that ensures reporting within 60 days of discovery.");
    recs.push("Implement a breach log to track all security incidents, including those affecting fewer than 500 individuals.");
  }

  if (gaps.length === 0) {
    recs.push("Your organization demonstrates strong HIPAA Security Rule compliance. Schedule a comprehensive risk analysis to validate these self-assessment results.");
  }

  return recs;
}

// =============================================================================
// Component
// =============================================================================

type Step = "intro" | "questions" | "results";

export default function QuickCheckPage() {
  const [step, setStep] = useState<Step>("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const [leadInfo, setLeadInfo] = useState({ name: "", email: "", company: "", role: "" });
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const results = useMemo(() => {
    if (Object.keys(answers).length < 20) return null;
    return calculateScores(answers);
  }, [answers]);

  const riskLevel = results ? getRiskLevel(results.overall) : null;
  const recommendations = results ? getRecommendations(results.gaps) : [];

  function handleAnswer(answer: boolean) {
    const q = QUESTIONS[currentQ];
    setAnswers(prev => ({ ...prev, [q.id]: answer }));

    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      setStep("results");
    }
  }

  function handleBack() {
    if (currentQ > 0) {
      setCurrentQ(currentQ - 1);
    }
  }

  function handleRestart() {
    setStep("intro");
    setCurrentQ(0);
    setAnswers({});
    setLeadInfo({ name: "", email: "", company: "", role: "" });
    setDownloading(false);
    setDownloadError(null);
  }

  async function handleDownload() {
    if (!results) return;
    setDownloading(true);
    setDownloadError(null);

    try {
      const resp = await fetch("/api/v1/hipaa/quickcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          lead: leadInfo,
          score: results.overall,
          groupScores: results.groupScores,
          gaps: results.gaps.map(g => ({
            id: g.id,
            text: g.text,
            reference: g.reference,
            category: g.category,
          })),
          recommendations,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Report generation failed" }));
        throw new Error(err.error ?? "Report generation failed");
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `HIPAA-QuickCheck-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDownloading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Intro Screen
  // ---------------------------------------------------------------------------
  if (step === "intro") {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white">
        <header className="border-b border-white/10 bg-gradient-to-b from-[#1a1a2e] to-[#0f172a]">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#2E5090]/20 px-4 py-1.5 text-sm font-medium text-[#6da1ff] mb-6">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Free Assessment
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
              Free HIPAA Quick-Check
            </h1>
            <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
              Answer 20 questions about your HIPAA Security Rule compliance. Get an instant risk score and a branded PDF report with gap analysis and recommendations.
            </p>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-6 py-12">
          {/* How it works */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            {[
              { step: "1", title: "Answer Questions", desc: "20 yes/no questions covering Administrative, Physical, and Technical Safeguards" },
              { step: "2", title: "Get Your Score", desc: "Instant weighted risk score with category breakdown and gap analysis" },
              { step: "3", title: "Download Report", desc: "Branded PDF with findings, HIPAA references, and recommendations" },
            ].map(s => (
              <div key={s.step} className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#2E5090] text-white font-bold text-lg mb-3">{s.step}</div>
                <h3 className="font-semibold text-white mb-1">{s.title}</h3>
                <p className="text-sm text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Categories overview */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 mb-8">
            <h2 className="text-xl font-bold mb-4">Assessment Coverage</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { name: "Administrative Safeguards", ref: "45 CFR \u00A7164.308", count: 8, weight: "40%" },
                { name: "Physical Safeguards", ref: "45 CFR \u00A7164.310", count: 4, weight: "15%" },
                { name: "Technical Safeguards", ref: "45 CFR \u00A7164.312", count: 6, weight: "35%" },
                { name: "Breach Notification", ref: "45 CFR \u00A7164.400-414", count: 2, weight: "10%" },
              ].map(c => (
                <div key={c.name} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">{c.name}</span>
                    <span className="text-xs text-[#6da1ff] font-mono">{c.weight}</span>
                  </div>
                  <p className="text-xs text-gray-500">{c.ref} &middot; {c.count} questions</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => setStep("questions")}
              className="rounded-xl bg-[#2E5090] px-12 py-4 text-lg font-bold text-white transition-all hover:bg-[#3a6bc5]"
            >
              Start Assessment
            </button>
            <p className="mt-4 text-xs text-gray-600">No login required. No data is stored. Takes approximately 3 minutes.</p>
          </div>
        </main>

        <footer className="border-t border-white/10 py-8 text-center">
          <p className="text-sm text-gray-500">Powered by Ducky Intelligence.</p>
          <p className="text-xs text-gray-600 mt-1">&copy; {new Date().getFullYear()} Cavaridge, LLC. All rights reserved.</p>
        </footer>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Questions Screen
  // ---------------------------------------------------------------------------
  if (step === "questions") {
    const question = QUESTIONS[currentQ];
    const progress = ((currentQ) / QUESTIONS.length) * 100;
    const prevAnswer = answers[question.id];

    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex flex-col">
        {/* Progress bar */}
        <div className="border-b border-white/10 bg-[#1a1a2e]">
          <div className="mx-auto max-w-3xl px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-400">
                Question {currentQ + 1} of {QUESTIONS.length}
              </span>
              <span className="text-sm font-medium text-[#6da1ff]">{question.category}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2E5090] to-[#6da1ff] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-2xl w-full text-center">
            <div className="mb-8">
              <span className="inline-block rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-mono text-gray-400 mb-6">
                {question.reference}
              </span>
              <h2 className="text-2xl font-bold leading-relaxed sm:text-3xl">
                {question.text}
              </h2>
            </div>

            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => handleAnswer(true)}
                className={`flex-1 max-w-[200px] rounded-xl border-2 py-5 text-lg font-bold transition-all ${
                  prevAnswer === true
                    ? "border-green-500 bg-green-500/20 text-green-400"
                    : "border-white/10 bg-white/5 text-white hover:border-green-500/50 hover:bg-green-500/10"
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => handleAnswer(false)}
                className={`flex-1 max-w-[200px] rounded-xl border-2 py-5 text-lg font-bold transition-all ${
                  prevAnswer === false
                    ? "border-red-500 bg-red-500/20 text-red-400"
                    : "border-white/10 bg-white/5 text-white hover:border-red-500/50 hover:bg-red-500/10"
                }`}
              >
                No
              </button>
            </div>

            {currentQ > 0 && (
              <button
                onClick={handleBack}
                className="mt-6 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                &larr; Previous question
              </button>
            )}
          </div>
        </div>

        <footer className="border-t border-white/10 py-4 text-center">
          <p className="text-xs text-gray-600">Powered by Ducky Intelligence.</p>
        </footer>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Results Screen
  // ---------------------------------------------------------------------------
  if (!results || !riskLevel) return null;

  const canDownload = leadInfo.name.trim() && leadInfo.email.trim() && leadInfo.company.trim();

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <header className="border-b border-white/10 bg-gradient-to-b from-[#1a1a2e] to-[#0f172a]">
        <div className="mx-auto max-w-4xl px-6 py-12 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl mb-2">
            Your HIPAA Quick-Check Results
          </h1>
          <p className="text-gray-400">Assessment completed {new Date().toLocaleDateString()}</p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* Overall Score */}
        <div className={`rounded-2xl border ${riskLevel.border} ${riskLevel.bg} p-8 mb-8 text-center`}>
          <div className="mb-4">
            <span className="text-6xl font-extrabold" style={{ color: riskLevel.color }}>
              {results.overall}
            </span>
            <span className="text-2xl text-gray-400 ml-1">/100</span>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ${riskLevel.bg} ${riskLevel.text} border ${riskLevel.border}`}>
            {riskLevel.label} Risk
          </div>
          <p className="mt-4 text-sm text-gray-400 max-w-xl mx-auto">
            {results.overall <= 40 && "Your organization has significant HIPAA Security Rule compliance gaps that require immediate attention."}
            {results.overall > 40 && results.overall <= 60 && "Your organization has notable compliance gaps. Several high-priority areas need remediation."}
            {results.overall > 60 && results.overall <= 80 && "Your organization has a reasonable compliance posture with some areas needing improvement."}
            {results.overall > 80 && "Your organization demonstrates strong HIPAA Security Rule compliance. Continue to maintain and validate these controls."}
          </p>
        </div>

        {/* Category Breakdown */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 mb-8">
          <h2 className="text-xl font-bold mb-6">Category Breakdown</h2>
          <div className="space-y-5">
            {(Object.entries(results.groupScores) as [SafeguardGroup, number][]).map(([group, score]) => {
              const level = getRiskLevel(score);
              return (
                <div key={group}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium text-white">{group}</span>
                      <span className="ml-2 text-xs text-gray-500">Weight: {GROUP_WEIGHTS[group]}%</span>
                    </div>
                    <span className="font-bold" style={{ color: level.color }}>{score}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${score}%`, backgroundColor: level.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Gaps */}
        {results.gaps.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 mb-8">
            <h2 className="text-xl font-bold mb-4">Compliance Gaps ({results.gaps.length})</h2>
            <div className="space-y-3">
              {results.gaps.map(gap => (
                <div key={gap.id} className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <svg className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="text-sm text-white">{gap.text}</p>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="text-xs font-mono text-gray-500">{gap.reference}</span>
                        <span className="text-xs text-gray-600">{gap.category}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 mb-8">
          <h2 className="text-xl font-bold mb-4">Recommendations</h2>
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1 h-5 w-5 rounded-full bg-[#2E5090]/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-[#6da1ff]">{i + 1}</span>
                </div>
                <p className="text-sm text-gray-300">{rec}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Lead Capture & Download */}
        <div className="rounded-2xl border border-[#2E5090]/30 bg-[#2E5090]/10 p-8 mb-8">
          <h2 className="text-xl font-bold mb-2">Download Your Full Report</h2>
          <p className="text-sm text-gray-400 mb-6">Enter your information to download a branded PDF report with your complete HIPAA Quick-Check results.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <input
              type="text"
              placeholder="Your Name *"
              value={leadInfo.name}
              onChange={e => setLeadInfo(prev => ({ ...prev, name: e.target.value }))}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-[#2E5090] focus:outline-none focus:ring-1 focus:ring-[#2E5090]"
            />
            <input
              type="email"
              placeholder="Email Address *"
              value={leadInfo.email}
              onChange={e => setLeadInfo(prev => ({ ...prev, email: e.target.value }))}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-[#2E5090] focus:outline-none focus:ring-1 focus:ring-[#2E5090]"
            />
            <input
              type="text"
              placeholder="Company Name *"
              value={leadInfo.company}
              onChange={e => setLeadInfo(prev => ({ ...prev, company: e.target.value }))}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-[#2E5090] focus:outline-none focus:ring-1 focus:ring-[#2E5090]"
            />
            <input
              type="text"
              placeholder="Your Role (optional)"
              value={leadInfo.role}
              onChange={e => setLeadInfo(prev => ({ ...prev, role: e.target.value }))}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-[#2E5090] focus:outline-none focus:ring-1 focus:ring-[#2E5090]"
            />
          </div>

          {downloadError && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {downloadError}
            </div>
          )}

          <button
            onClick={handleDownload}
            disabled={!canDownload || downloading}
            className="w-full rounded-xl bg-[#2E5090] py-4 text-lg font-bold text-white transition-all hover:bg-[#3a6bc5] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating Report...
              </span>
            ) : (
              "Download PDF Report"
            )}
          </button>
        </div>

        {/* What's Next Upsell */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 mb-8">
          <h2 className="text-xl font-bold mb-4">What&apos;s Next?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#2E5090]/30 bg-[#2E5090]/10 p-5">
              <h3 className="font-semibold text-[#6da1ff] mb-2">Full HIPAA Risk Assessment</h3>
              <p className="text-sm text-gray-400 mb-3">
                This Quick-Check covers 20 high-level controls. A comprehensive HIPAA risk analysis evaluates 300+ implementation specifications across all safeguard categories with evidence collection and remediation tracking.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>&#8226; Complete 45 CFR Part 164 control evaluation</li>
                <li>&#8226; Evidence documentation and artifact management</li>
                <li>&#8226; Risk-prioritized remediation roadmap</li>
                <li>&#8226; Ongoing compliance monitoring and calendar</li>
              </ul>
            </div>
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-5">
              <h3 className="font-semibold text-purple-300 mb-2">AEGIS Security Platform</h3>
              <p className="text-sm text-gray-400 mb-3">
                Continuous security monitoring, browser security enforcement, credential hygiene tracking, and DLP controls that directly support HIPAA Technical Safeguard compliance.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>&#8226; Real-time ePHI exfiltration prevention (DLP)</li>
                <li>&#8226; Multi-factor authentication enforcement</li>
                <li>&#8226; Cavaridge Adjusted Security Score</li>
                <li>&#8226; Automated compliance evidence collection</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-gray-600 mb-4">
          This is a preliminary self-assessment tool. It does not constitute legal advice or a comprehensive HIPAA risk analysis as required by 45 CFR &sect;164.308(a)(1)(ii)(A). A full risk analysis conducted by qualified professionals is required for HIPAA compliance. Your data is processed in real-time and never stored.
        </p>

        {/* Restart */}
        <div className="text-center mb-8">
          <button
            onClick={handleRestart}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Retake Assessment
          </button>
        </div>
      </main>

      <footer className="border-t border-white/10 py-8 text-center">
        <p className="text-sm text-gray-500">Powered by Ducky Intelligence.</p>
        <p className="text-xs text-gray-600 mt-1">&copy; {new Date().getFullYear()} Cavaridge, LLC. All rights reserved.</p>
      </footer>
    </div>
  );
}
