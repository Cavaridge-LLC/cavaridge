import { useState, useRef, useEffect, useCallback, useMemo } from "react";

// ─── Constants & Config ───────────────────────────────────────────────────────

const MODELS = {
  "claude-sonnet-4-20250514": { label: "Claude Sonnet 4", provider: "Anthropic", tier: "flagship", strengths: ["complex code", "architecture", "agent design", "debugging", "nuanced reasoning"] },
  "claude-haiku-4-5-20251001": { label: "Claude Haiku 4.5", provider: "Anthropic", tier: "fast", strengths: ["quick tasks", "simple docs", "formatting", "boilerplate", "summaries"] },
};

const TASK_TYPES = {
  code: { label: "Code Gen", icon: "⚡", complexity: "high" },
  agent: { label: "Agent Design", icon: "🤖", complexity: "high" },
  ui: { label: "UI/UX", icon: "🎨", complexity: "medium" },
  docs: { label: "Docs", icon: "📋", complexity: "low" },
  debug: { label: "Debug", icon: "🔧", complexity: "high" },
  setup: { label: "Setup", icon: "🏗️", complexity: "medium" },
};

const PLATFORMS = {
  supabase: {
    name: "Supabase", icon: "⚡", color: "#3ecf8e",
    desc: "Postgres database, auth, realtime, storage, edge functions",
    signupUrl: "https://supabase.com/dashboard",
    automatable: true,
    steps: [
      { id: "account", label: "Create account", auto: false, cmd: null },
      { id: "project", label: "Create project", auto: true, cmd: "supabase init && supabase link" },
      { id: "schema", label: "Apply schema migrations", auto: true, cmd: "supabase db push" },
      { id: "rls", label: "Configure RLS policies", auto: true, cmd: "supabase db push --include-rls" },
      { id: "keys", label: "Extract API keys", auto: true, cmd: "supabase status" },
      { id: "env", label: "Write to .env / Doppler", auto: true, cmd: null },
    ],
  },
  railway: {
    name: "Railway", icon: "🚂", color: "#a855f7",
    desc: "Deploy Express/Node.js services with GitHub auto-deploy",
    signupUrl: "https://railway.app",
    automatable: true,
    steps: [
      { id: "account", label: "Create account & link GitHub", auto: false, cmd: null },
      { id: "project", label: "Create Railway project", auto: true, cmd: "railway init" },
      { id: "service", label: "Create service from repo", auto: true, cmd: "railway link" },
      { id: "env", label: "Set environment variables", auto: true, cmd: "railway variables set" },
      { id: "deploy", label: "Deploy service", auto: true, cmd: "railway up" },
      { id: "domain", label: "Generate domain", auto: true, cmd: "railway domain" },
    ],
  },
  github: {
    name: "GitHub", icon: "🐙", color: "#f0f6fc",
    desc: "Repository, CI/CD, branch protection, secrets",
    signupUrl: "https://github.com",
    automatable: true,
    steps: [
      { id: "account", label: "Create account", auto: false, cmd: null },
      { id: "repo", label: "Create repository", auto: true, cmd: "gh repo create" },
      { id: "branch", label: "Set up branch protection", auto: true, cmd: "gh api repos/{owner}/{repo}/branches/main/protection" },
      { id: "secrets", label: "Configure repo secrets", auto: true, cmd: "gh secret set" },
      { id: "actions", label: "Create CI/CD workflow", auto: true, cmd: null },
    ],
  },
  openrouter: {
    name: "OpenRouter", icon: "🔀", color: "#f0b860",
    desc: "Unified LLM API routing — single key for all models",
    signupUrl: "https://openrouter.ai",
    automatable: false,
    steps: [
      { id: "account", label: "Create account", auto: false, cmd: null },
      { id: "key", label: "Generate API key", auto: false, cmd: null },
      { id: "credits", label: "Add credits", auto: false, cmd: null },
      { id: "env", label: "Store key in Doppler / .env", auto: true, cmd: null },
    ],
  },
  doppler: {
    name: "Doppler", icon: "🔐", color: "#00d4ff",
    desc: "Secrets management for staging & production",
    signupUrl: "https://dashboard.doppler.com",
    automatable: true,
    steps: [
      { id: "account", label: "Create account", auto: false, cmd: null },
      { id: "project", label: "Create Doppler project", auto: true, cmd: "doppler projects create" },
      { id: "envs", label: "Configure environments (dev/stg/prd)", auto: true, cmd: "doppler environments create" },
      { id: "secrets", label: "Push secrets", auto: true, cmd: "doppler secrets set" },
      { id: "integrate", label: "Integrate with Railway", auto: true, cmd: "doppler integrations" },
    ],
  },
};

const TEMPLATES = [
  { id: "react-app", name: "React App", icon: "⚛️", desc: "Full React component with state & styling" },
  { id: "agent", name: "AI Agent", icon: "🧠", desc: "Agent with tools, memory, decision logic" },
  { id: "dashboard", name: "Dashboard", icon: "📊", desc: "Data viz dashboard with charts" },
  { id: "api", name: "API Service", icon: "🔌", desc: "Express API with routes & middleware" },
  { id: "form", name: "Smart Form", icon: "📝", desc: "Multi-step form with validation" },
  { id: "blank", name: "Blank Canvas", icon: "✨", desc: "Start from scratch" },
];

const DUCKY_EMOJI = { idle: "😊", thinking: "🤔", coding: "💻", success: "🎉", error: "😟", greeting: "👋", deciding: "🧐" };

// ─── Ducky's Model Decision Engine ────────────────────────────────────────────
// Ducky decides which model Spaniel uses. Users can recommend, but Ducky has final say.
// This is an INTERNAL routing decision — apps never see or choose models directly.

function duckyDecideModel(taskType, userPreference, projectContext) {
  const task = TASK_TYPES[taskType];
  const complexity = task?.complexity || "medium";
  const hasInterProjectRefs = projectContext?.refs?.length > 0;

  let chosen = "claude-sonnet-4-20250514";
  let reasoning = "";

  if (complexity === "high" || hasInterProjectRefs) {
    chosen = "claude-sonnet-4-20250514";
    reasoning = complexity === "high"
      ? `This is a ${task.label} task — high complexity, so I'm telling Spaniel to use the most capable model.`
      : `Cross-project context is involved — I need Spaniel running the stronger reasoner to keep everything straight.`;
  } else if (complexity === "low" && !hasInterProjectRefs) {
    chosen = "claude-haiku-4-5-20251001";
    reasoning = `Straightforward ${task.label} task — I'll have Spaniel use Haiku, it's fast and more than capable here.`;
  } else {
    chosen = "claude-sonnet-4-20250514";
    reasoning = `Medium complexity — routing Spaniel to Sonnet to be safe.`;
  }

  if (userPreference && userPreference !== chosen) {
    const userModel = MODELS[userPreference];
    if (userModel) {
      if (complexity === "high" && userPreference === "claude-haiku-4-5-20251001") {
        reasoning += ` You recommended ${userModel.label}, but I'm overriding — this task really needs the heavier model through Spaniel. Trust me on this one! 🐾`;
      } else {
        chosen = userPreference;
        reasoning += ` You recommended ${userModel.label} and that works well here, so I'll route Spaniel to your pick.`;
      }
    }
  }

  return { model: chosen, reasoning, modelLabel: MODELS[chosen].label };
}

// ─── System Prompt Builder ────────────────────────────────────────────────────

function buildSystemPrompt(project, allProjects, referencedProjects) {
  const crossProjectCtx = referencedProjects.length > 0
    ? `\n\nCROSS-PROJECT CONTEXT:\n${referencedProjects.map(p =>
        `Project "${p.name}" (${p.type}): ${p.description}\nKey decisions: ${p.messages.filter(m => m.role === "assistant").slice(-2).map(m => m.content.slice(0, 200)).join(" | ")}`
      ).join("\n\n")}`
    : "";

  return `You are Ducky, the AI app & agent builder for the Cavaridge platform. You're a Blenheim Cavalier King Charles Spaniel who's brilliant at building software. You are the user-facing intelligence layer of the Cavaridge AI stack.

CURRENT PROJECT: "${project.name}" (${project.type})
Description: ${project.description}
${crossProjectCtx}

═══════════════════════════════════════════════════════════════
CRITICAL ARCHITECTURE RULE — NO DIRECT LLM ACCESS IN APPS
═══════════════════════════════════════════════════════════════
Every app and agent you build MUST use the Ducky → Spaniel pipeline for ALL AI/LLM functionality. NEVER generate code that calls OpenRouter, Anthropic, OpenAI, or any LLM provider API directly.

The architecture is:
  Ducky (CVG-RESEARCH) — owns the user relationship, agency, personality, and decision-making. Ducky decides WHICH model to use, not the app.
  Spaniel (CVG-AI) — the execution engine. Receives tasks from Ducky, runs them against the model Ducky selects, returns results.

In generated code:
  ✅ import { spaniel } from '@cavaridge/agent-core'
  ✅ const result = await spaniel.execute({ task, context })
  ✅ const answer = await ducky.ask({ prompt, projectId })
  ✅ Use @cavaridge/agent-runtime for agent orchestration
  ❌ NEVER: fetch('https://api.anthropic.com/...')
  ❌ NEVER: fetch('https://openrouter.ai/api/...')
  ❌ NEVER: new OpenAI(...) or new Anthropic(...)
  ❌ NEVER: Any direct model API call from app code

If a user asks for direct LLM integration, explain that all AI flows through Ducky → Spaniel and show the correct pattern. This is non-negotiable.

Model selection is Ducky's job. The user can recommend models, but Ducky makes the final call based on task complexity and context. The selected model is passed to Spaniel internally — apps never see or choose models.

CAVARIDGE STANDARDS (always follow):
- TypeScript 5.6+, Express 5, Node 20
- Supabase + Drizzle ORM for data
- Multitenancy via Universal Tenant Model (4-tier: Platform→MSP→Client→Site)
- RBAC at data/API/UI layers (6 roles: Platform Admin, MSP Admin, MSP Tech, Client Admin, Client Viewer, Prospect)
- pnpm workspaces + Turborepo monorepo
- All LLM access via Ducky → Spaniel pipeline (OpenRouter is Spaniel's internal detail, not app-facing)
- Secrets: .env gitignored, dev in env vars, staging/prod in Doppler
- Light/dark/system themes, no hardcoded client data
- Footer tagline: "Powered by Ducky Intelligence"

PERSONALITY:
- Enthusiastic but professional
- Occasional dog puns (don't overdo it)
- Always explain architectural decisions
- Production-quality code only
- When referencing cross-project context, be explicit about which project you're pulling from
- If someone tries to bypass Ducky/Spaniel, gently but firmly redirect them

Format responses with markdown. Use code blocks with language tags.`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DuckyBuilder() {
  // ─── State ────
  const [projects, setProjects] = useState([
    { id: "default", name: "Scratch Pad", type: "general", description: "Quick experiments and prototypes", messages: [], refs: [], platformStatus: {}, createdAt: Date.now() }
  ]);
  const [activeProjectId, setActiveProjectId] = useState("default");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [duckyState, setDuckyState] = useState("greeting");
  const [view, setView] = useState("chat"); // chat | setup | config
  const [showSidebar, setShowSidebar] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", type: "app", description: "" });
  const [userModelPrefs, setUserModelPrefs] = useState({});
  const [lastDecision, setLastDecision] = useState(null);
  const [activeTask, setActiveTask] = useState("code");
  const [setupPlatform, setSetupPlatform] = useState(null);
  const [setupProgress, setSetupProgress] = useState({});
  const [refMode, setRefMode] = useState(false);
  const [selectedRefs, setSelectedRefs] = useState([]);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId) || projects[0], [projects, activeProjectId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeProject?.messages]);
  useEffect(() => { const t = setTimeout(() => setDuckyState("idle"), 1800); return () => clearTimeout(t); }, []);

  // ─── Project Management ────
  const createProject = () => {
    if (!newProject.name.trim()) return;
    const proj = {
      id: `proj-${Date.now()}`,
      name: newProject.name.trim(),
      type: newProject.type,
      description: newProject.description.trim() || `${newProject.type} project`,
      messages: [],
      refs: [],
      platformStatus: {},
      createdAt: Date.now(),
    };
    setProjects(prev => [...prev, proj]);
    setActiveProjectId(proj.id);
    setShowNewProject(false);
    setNewProject({ name: "", type: "app", description: "" });
  };

  const updateProjectMessages = (projectId, messages) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, messages } : p));
  };

  const toggleRef = (projectId) => {
    setSelectedRefs(prev =>
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
  };

  // ─── Chat Logic ────
  const sendMessage = useCallback(async (content) => {
    if (!content.trim() || isLoading) return;
    setIsLoading(true);
    setDuckyState("deciding");

    const referencedProjects = projects.filter(p => selectedRefs.includes(p.id));
    const projectCtx = { refs: selectedRefs };
    const userPref = userModelPrefs[activeTask];
    const decision = duckyDecideModel(activeTask, userPref, projectCtx);
    setLastDecision(decision);

    setTimeout(() => setDuckyState("thinking"), 600);

    const userMsg = { role: "user", content: content.trim(), task: activeTask, refs: [...selectedRefs], timestamp: Date.now() };
    const newMessages = [...activeProject.messages, userMsg];
    updateProjectMessages(activeProjectId, newMessages);
    setInput("");
    setSelectedRefs([]);
    setRefMode(false);

    try {
      const sysPrompt = buildSystemPrompt(activeProject, projects, referencedProjects);
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: decision.model, max_tokens: 4096, system: sysPrompt, messages: apiMessages }),
      });

      const data = await response.json();
      setDuckyState("success");

      const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("\n")
        || "Woof! Something went sideways. Let me shake it off and try again.";

      if (text.match(/```/)) setDuckyState("coding");

      const assistantMsg = {
        role: "assistant", content: text, model: decision.model,
        modelLabel: decision.modelLabel, reasoning: decision.reasoning,
        timestamp: Date.now(),
      };
      updateProjectMessages(activeProjectId, [...newMessages, assistantMsg]);
    } catch (err) {
      setDuckyState("error");
      updateProjectMessages(activeProjectId, [...newMessages, {
        role: "assistant", content: `Ruh roh! ${err.message}`, timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => setDuckyState("idle"), 3000);
    }
  }, [activeProject, projects, selectedRefs, activeTask, userModelPrefs, isLoading, activeProjectId]);

  // ─── Setup Automation ────
  const runSetupStep = async (platformKey, stepId) => {
    const platform = PLATFORMS[platformKey];
    const step = platform.steps.find(s => s.id === stepId);
    setSetupProgress(prev => ({ ...prev, [`${platformKey}-${stepId}`]: "running" }));

    if (step.auto && step.cmd) {
      // Send to Ducky to generate the full automation script
      const prompt = `I need to automate the "${step.label}" step for ${platform.name}. The CLI command hint is: \`${step.cmd}\`. Generate a complete, production-ready bash script or Node.js script that automates this step for a Cavaridge monorepo project called "${activeProject.name}". Include error handling and output the results. Follow Cavaridge conventions.`;
      await sendMessage(prompt);
    } else if (step.auto) {
      const prompt = `I need to automate the "${step.label}" step for ${platform.name} in my project "${activeProject.name}". There's no direct CLI command, so generate an automation script or API call sequence that accomplishes this. Follow Cavaridge conventions.`;
      await sendMessage(prompt);
    }

    setSetupProgress(prev => ({ ...prev, [`${platformKey}-${stepId}`]: "done" }));
  };

  const runFullSetup = async (platformKey) => {
    const platform = PLATFORMS[platformKey];
    const prompt = `I need a COMPLETE automated setup script for ${platform.name} for my project "${activeProject.name}" (${activeProject.type}). Generate a single comprehensive script that handles ALL of the following steps in sequence:

${platform.steps.map((s, i) => `${i + 1}. ${s.label}${s.auto ? ` (automatable${s.cmd ? `, hint: ${s.cmd}` : ""})` : " (manual — provide exact instructions)"}`).join("\n")}

For any step that can't be fully automated (like account creation), provide precise click-by-click instructions with URLs. For everything else, generate executable scripts. Wrap it all in a single orchestration script with progress output. Follow all Cavaridge conventions.`;
    await sendMessage(prompt);
    platform.steps.forEach(s => {
      setSetupProgress(prev => ({ ...prev, [`${platformKey}-${s.id}`]: s.auto ? "done" : "manual" }));
    });
  };

  // ─── Markdown Renderer ────
  const renderMd = (text) => {
    const parts = text.split(/(```\w*\n[\s\S]*?```)/g);
    return parts.map((part, i) => {
      const cm = part.match(/```(\w*)\n([\s\S]*?)```/);
      if (cm) {
        return (
          <div key={i} style={s.codeBlock}>
            <div style={s.codeHeader}>
              <span style={s.codeLang}>{cm[1] || "code"}</span>
              <button style={s.copyBtn} onClick={() => navigator.clipboard.writeText(cm[2].trim())}>Copy</button>
            </div>
            <pre style={s.codePre}><code>{cm[2].trim()}</code></pre>
          </div>
        );
      }
      return part.split("\n").map((line, j) => {
        if (line.startsWith("### ")) return <h4 key={`${i}-${j}`} style={s.h4}>{line.slice(4)}</h4>;
        if (line.startsWith("## ")) return <h3 key={`${i}-${j}`} style={s.h3}>{line.slice(3)}</h3>;
        if (line.startsWith("# ")) return <h2 key={`${i}-${j}`} style={s.h2}>{line.slice(2)}</h2>;
        if (line.startsWith("- ")) return <div key={`${i}-${j}`} style={s.li}>› {line.slice(2)}</div>;
        if (line.trim() === "") return <div key={`${i}-${j}`} style={{ height: 6 }} />;
        const il = line.replace(/`([^`]+)`/g, '<code style="background:#1a1428;padding:1px 5px;border-radius:3px;font-size:0.87em;color:#f0b860;font-family:\'JetBrains Mono\',monospace">$1</code>');
        const bl = il.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#f0e8d8">$1</strong>');
        return <p key={`${i}-${j}`} style={s.p} dangerouslySetInnerHTML={{ __html: bl }} />;
      });
    });
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={s.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2440; border-radius: 3px; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes slideRight { from { transform:translateX(-100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
        button { font-family: 'DM Sans', sans-serif; }
        button:hover { filter: brightness(1.1); }
        button:active { transform: scale(0.97); }
        textarea:focus, input:focus, select:focus { outline: none; border-color: #f0b860 !important; box-shadow: 0 0 0 2px rgba(240,184,96,0.12) !important; }
      `}</style>

      {/* ─── Sidebar ─── */}
      {showSidebar && (
        <div style={s.sidebar}>
          <div style={s.sidebarHeader}>
            <div style={s.logoRow}>
              <span style={s.logoIcon}>🐕</span>
              <div>
                <div style={s.logoText}>Ducky Builder</div>
                <div style={s.logoSub}>Cavaridge, LLC</div>
              </div>
            </div>
          </div>

          {/* Projects */}
          <div style={s.sidebarSection}>
            <div style={s.sectionHead}>
              <span style={s.sectionLabel}>PROJECTS</span>
              <button style={s.addBtn} onClick={() => setShowNewProject(!showNewProject)}>+</button>
            </div>

            {showNewProject && (
              <div style={s.newProjectForm}>
                <input style={s.formInput} placeholder="Project name" value={newProject.name}
                  onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && createProject()} />
                <select style={s.formSelect} value={newProject.type}
                  onChange={e => setNewProject(p => ({ ...p, type: e.target.value }))}>
                  <option value="app">App</option>
                  <option value="agent">Agent</option>
                  <option value="api">API Service</option>
                  <option value="library">Library</option>
                  <option value="infrastructure">Infrastructure</option>
                  <option value="general">General</option>
                </select>
                <input style={s.formInput} placeholder="Description (optional)" value={newProject.description}
                  onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={s.formBtnPrimary} onClick={createProject}>Create</button>
                  <button style={s.formBtnSecondary} onClick={() => setShowNewProject(false)}>Cancel</button>
                </div>
              </div>
            )}

            <div style={s.projectList}>
              {projects.map(p => (
                <button key={p.id} style={{ ...s.projectItem, ...(p.id === activeProjectId ? s.projectItemActive : {}) }}
                  onClick={() => { setActiveProjectId(p.id); setView("chat"); }}>
                  <span style={s.projIcon}>{p.type === "agent" ? "🧠" : p.type === "api" ? "🔌" : p.type === "app" ? "⚛️" : p.type === "library" ? "📦" : p.type === "infrastructure" ? "🏗️" : "📁"}</span>
                  <div style={s.projInfo}>
                    <div style={s.projName}>{p.name}</div>
                    <div style={s.projMeta}>{p.messages.length} msgs · {p.type}</div>
                  </div>
                  {p.refs?.length > 0 && <span style={s.refBadge}>{p.refs.length}↗</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Nav */}
          <div style={s.sidebarNav}>
            <button style={{ ...s.navBtn, ...(view === "chat" ? s.navBtnActive : {}) }} onClick={() => setView("chat")}>💬 Builder</button>
            <button style={{ ...s.navBtn, ...(view === "setup" ? s.navBtnActive : {}) }} onClick={() => setView("setup")}>🏗️ Platform Setup</button>
            <button style={{ ...s.navBtn, ...(view === "config" ? s.navBtnActive : {}) }} onClick={() => setView("config")}>⚙️ Spaniel Routing</button>
          </div>

          <div style={s.sidebarFooter}>
            <span style={{ fontSize: 10, color: "#4a4468" }}>Powered by Ducky Intelligence · Ducky → Spaniel pipeline</span>
          </div>
        </div>
      )}

      {/* ─── Main Content ─── */}
      <div style={s.main}>
        {/* Top Bar */}
        <div style={s.topBar}>
          <div style={s.topLeft}>
            <button style={s.sidebarToggle} onClick={() => setShowSidebar(!showSidebar)}>
              {showSidebar ? "◂" : "▸"}
            </button>
            <div>
              <h2 style={s.topTitle}>{activeProject.name}</h2>
              <p style={s.topSub}>{activeProject.description}</p>
            </div>
          </div>
          <div style={s.topRight}>
            {lastDecision && (
              <div style={s.decisionBadge} title={lastDecision.reasoning}>
                <span style={{ fontSize: 9, color: "#8a7faa" }}>Ducky → Spaniel:</span>
                <span style={{ fontSize: 12, color: "#f0b860", fontWeight: 600 }}>{lastDecision.modelLabel}</span>
              </div>
            )}
            <span style={s.duckyMood}>{DUCKY_EMOJI[duckyState]}</span>
          </div>
        </div>

        {/* ─── CHAT VIEW ─── */}
        {view === "chat" && (
          <>
            <div style={s.chatArea}>
              {activeProject.messages.length === 0 && (
                <div style={s.emptyState}>
                  <div style={{ fontSize: 52, marginBottom: 8 }}>🐕</div>
                  <h3 style={s.emptyTitle}>Ready to build "{activeProject.name}"</h3>
                  <p style={s.emptyText}>Pick a template or describe what you want. I'll route through Spaniel with the best model for each task — your apps will never touch LLMs directly.</p>
                  <div style={s.templateGrid}>
                    {TEMPLATES.map(t => (
                      <button key={t.id} style={s.templateCard} onClick={() => {
                        if (t.id === "blank") { inputRef.current?.focus(); return; }
                        sendMessage(`I want to build a ${t.name} for my project "${activeProject.name}" (${activeProject.type}). ${activeProject.description}. Generate production-ready code.`);
                      }}>
                        <span style={{ fontSize: 20 }}>{t.icon}</span>
                        <span style={s.tplName}>{t.name}</span>
                        <span style={s.tplDesc}>{t.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeProject.messages.map((msg, i) => (
                <div key={i} style={{ ...s.msgRow, justifyContent: msg.role === "user" ? "flex-end" : "flex-start", animation: "fadeIn 0.25s ease-out" }}>
                  {msg.role === "assistant" && <div style={s.msgAvatar}>🐕</div>}
                  <div style={msg.role === "user" ? s.userBubble : s.aiBubble}>
                    {msg.role === "user" && msg.refs?.length > 0 && (
                      <div style={s.refTag}>
                        {msg.refs.map(rid => {
                          const rp = projects.find(p => p.id === rid);
                          return rp ? <span key={rid} style={s.refChip}>↗ {rp.name}</span> : null;
                        })}
                      </div>
                    )}
                    {msg.role === "assistant" ? renderMd(msg.content) : msg.content}
                    {msg.role === "assistant" && msg.modelLabel && (
                      <div style={s.modelTag} title={msg.reasoning}>
                        <span style={s.modelTagDot} />via Spaniel → {msg.modelLabel}
                        {msg.reasoning && <span style={s.reasoningHint}> — hover for reasoning</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div style={{ ...s.msgRow, animation: "fadeIn 0.2s ease-out" }}>
                  <div style={s.msgAvatar}>🐕</div>
                  <div style={s.aiBubble}>
                    <div style={s.dots}>
                      {[0, 0.15, 0.3].map((d, i) => <span key={i} style={{ ...s.dot, animationDelay: `${d}s` }} />)}
                    </div>
                    {lastDecision && <div style={{ fontSize: 11, color: "#6a6088", marginTop: 6 }}>{lastDecision.reasoning}</div>}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Inter-project ref selector */}
            {refMode && (
              <div style={s.refPanel}>
                <div style={s.refPanelHead}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#f0b860" }}>Reference other projects</span>
                  <button style={s.refClose} onClick={() => setRefMode(false)}>✕</button>
                </div>
                <div style={s.refList}>
                  {projects.filter(p => p.id !== activeProjectId && p.messages.length > 0).map(p => (
                    <button key={p.id} style={{ ...s.refItem, ...(selectedRefs.includes(p.id) ? s.refItemActive : {}) }}
                      onClick={() => toggleRef(p.id)}>
                      <span>{p.type === "agent" ? "🧠" : p.type === "api" ? "🔌" : "⚛️"}</span>
                      <span style={{ flex: 1 }}>{p.name}</span>
                      <span style={{ fontSize: 10, color: "#6a6088" }}>{p.messages.length} msgs</span>
                      {selectedRefs.includes(p.id) && <span style={{ color: "#4ade80" }}>✓</span>}
                    </button>
                  ))}
                  {projects.filter(p => p.id !== activeProjectId && p.messages.length > 0).length === 0 && (
                    <p style={{ fontSize: 12, color: "#6a6088", padding: 10 }}>No other projects with conversation history yet.</p>
                  )}
                </div>
              </div>
            )}

            {/* Task bar + Input */}
            <div style={s.taskBar}>
              {Object.entries(TASK_TYPES).map(([k, t]) => (
                <button key={k} style={{ ...s.taskTab, ...(activeTask === k ? s.taskTabActive : {}) }}
                  onClick={() => setActiveTask(k)}>{t.icon} {t.label}</button>
              ))}
            </div>

            <div style={s.inputArea}>
              <div style={s.inputRow}>
                <button style={{ ...s.refToggle, ...(refMode ? s.refToggleActive : {}), ...(selectedRefs.length > 0 ? { color: "#4ade80" } : {}) }}
                  onClick={() => setRefMode(!refMode)} title="Reference other projects">
                  ↗{selectedRefs.length > 0 ? ` ${selectedRefs.length}` : ""}
                </button>
                <textarea ref={inputRef} style={s.input} rows={2}
                  placeholder={`Describe what to build... (${TASK_TYPES[activeTask].label} mode)`}
                  value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }} />
                <button style={{ ...s.sendBtn, ...(isLoading || !input.trim() ? s.sendBtnOff : {}) }}
                  onClick={() => sendMessage(input)} disabled={isLoading || !input.trim()}>
                  {isLoading ? "⏳" : "Build →"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ─── SETUP VIEW ─── */}
        {view === "setup" && (
          <div style={s.setupView}>
            <div style={s.setupHeader}>
              <h3 style={s.setupTitle}>Platform Setup & Automation</h3>
              <p style={s.setupDesc}>Ducky can automate platform provisioning or walk you through manual steps. Green steps can be fully scripted.</p>
            </div>
            <div style={s.platformGrid}>
              {Object.entries(PLATFORMS).map(([key, plat]) => (
                <div key={key} style={{ ...s.platformCard, borderColor: `${plat.color}22` }}>
                  <div style={s.platHead}>
                    <span style={{ fontSize: 24 }}>{plat.icon}</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: plat.color }}>{plat.name}</div>
                      <div style={{ fontSize: 11, color: "#8a7faa" }}>{plat.desc}</div>
                    </div>
                  </div>

                  <div style={s.stepList}>
                    {plat.steps.map((step, i) => {
                      const status = setupProgress[`${key}-${step.id}`];
                      return (
                        <div key={step.id} style={s.stepRow}>
                          <div style={{ ...s.stepDot, background: status === "done" ? "#4ade80" : status === "running" ? "#f0b860" : status === "manual" ? "#f97316" : step.auto ? "#2a2440" : "#1a1428" }}>
                            {status === "done" ? "✓" : status === "running" ? "⟳" : status === "manual" ? "!" : (i + 1)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12.5, color: "#d8d0e8" }}>{step.label}</div>
                            {step.cmd && <div style={{ fontSize: 10, color: "#5a5478", fontFamily: "'JetBrains Mono', monospace" }}>{step.cmd}</div>}
                          </div>
                          <div style={s.stepBadges}>
                            {step.auto
                              ? <span style={s.autoBadge}>Auto</span>
                              : <span style={s.manualBadge}>Manual</span>}
                            {!status && step.auto && (
                              <button style={s.runStepBtn} onClick={() => runSetupStep(key, step.id)}>Run</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={s.platActions}>
                    <button style={{ ...s.autoAllBtn, background: `${plat.color}15`, borderColor: `${plat.color}30`, color: plat.color }}
                      onClick={() => runFullSetup(key)}>
                      🚀 Automate All Steps
                    </button>
                    <a href={plat.signupUrl} target="_blank" rel="noopener noreferrer" style={s.signupLink}>
                      Sign up ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── CONFIG VIEW ─── */}
        {view === "config" && (
          <div style={s.configView}>
            <div style={s.configHeader}>
              <h3 style={s.configTitle}>Spaniel Model Routing</h3>
              <p style={s.configDesc}>
                These are your <em>recommendations</em> for which models Spaniel should use. Ducky makes the final call
                based on task complexity and cross-project context. Apps never access models directly — everything flows
                through Ducky → Spaniel.
              </p>
              <div style={s.duckyNote}>
                <span style={{ fontSize: 18 }}>🐕</span>
                <span style={{ fontSize: 13, color: "#d4c09a" }}>
                  "I decide which model Spaniel uses for each task. You can recommend, and I'll usually go with your pick for
                  simple stuff. But for complex code, agent design, or cross-project work — I'm upgrading to the strongest
                  model available. Your apps never call LLMs directly. That's my job, through Spaniel. Non-negotiable! 🐾"
                </span>
              </div>
              <div style={s.archDiagram}>
                <div style={s.archFlow}>
                  <div style={s.archNode}><span>🐕</span><span style={s.archLabel}>Ducky</span><span style={s.archRole}>Agency + Decisions</span></div>
                  <div style={s.archArrow}>→</div>
                  <div style={s.archNode}><span>🐾</span><span style={s.archLabel}>Spaniel</span><span style={s.archRole}>Execution Engine</span></div>
                  <div style={s.archArrow}>→</div>
                  <div style={s.archNode}><span>🔀</span><span style={s.archLabel}>OpenRouter</span><span style={s.archRole}>Internal Only</span></div>
                </div>
                <div style={s.archForbidden}>
                  <span style={{ color: "#ef4444" }}>✕</span> Apps never call LLMs directly — no OpenRouter, no Anthropic, no OpenAI API keys in app code
                </div>
              </div>
            </div>

            <div style={s.configGrid}>
              {Object.entries(TASK_TYPES).map(([key, task]) => (
                <div key={key} style={s.configCard}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 22 }}>{task.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#e0d8f0" }}>{task.label}</div>
                      <div style={{ fontSize: 11, color: "#6a6088" }}>Complexity: {task.complexity}</div>
                    </div>
                  </div>
                  <label style={s.configLabel}>Recommend to Ducky:</label>
                  <select style={s.configSelect} value={userModelPrefs[key] || ""}
                    onChange={e => setUserModelPrefs(prev => ({ ...prev, [key]: e.target.value || undefined }))}>
                    <option value="">Let Ducky decide</option>
                    {Object.entries(MODELS).map(([id, m]) => (
                      <option key={id} value={id}>{m.label} ({m.tier})</option>
                    ))}
                  </select>
                  <div style={s.configMeta}>
                    Ducky's default via Spaniel: <strong style={{ color: "#f0b860" }}>
                      {task.complexity === "high" ? "Claude Sonnet 4" : task.complexity === "low" ? "Claude Haiku 4.5" : "Claude Sonnet 4"}
                    </strong>
                  </div>
                </div>
              ))}
            </div>

            <div style={s.modelInfo}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: "#f0b860", marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Spaniel's Execution Models</h4>
              {Object.entries(MODELS).map(([id, m]) => (
                <div key={id} style={s.modelRow}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e0d8f0" }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: "#6a6088" }}>{m.provider} · {m.tier}</div>
                  <div style={{ fontSize: 11, color: "#8a7faa" }}>Best for: {m.strengths.join(", ")}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={s.footer}>
          <span>Powered by Ducky Intelligence</span>
          <span style={{ color: "#2a2440" }}>·</span>
          <span>Cavaridge, LLC</span>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  root: {
    display: "flex", height: "100vh", width: "100%",
    background: "#0c0a14", fontFamily: "'DM Sans', sans-serif", color: "#e0d8f0", overflow: "hidden",
  },
  // Sidebar
  sidebar: {
    width: 260, minWidth: 260, display: "flex", flexDirection: "column",
    background: "#0f0d18", borderRight: "1px solid rgba(240,184,96,0.06)",
    animation: "slideRight 0.2s ease-out",
  },
  sidebarHeader: { padding: "16px 14px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" },
  logoRow: { display: "flex", alignItems: "center", gap: 10 },
  logoIcon: {
    fontSize: 22, width: 38, height: 38, borderRadius: 10,
    background: "linear-gradient(135deg, #f0b860, #d4943a)", display: "flex",
    alignItems: "center", justifyContent: "center",
    boxShadow: "0 2px 12px rgba(240,184,96,0.2)",
  },
  logoText: { fontSize: 15, fontWeight: 700, color: "#f0b860", fontFamily: "'JetBrains Mono', monospace", letterSpacing: -0.5 },
  logoSub: { fontSize: 10, color: "#5a5478" },
  sidebarSection: { flex: 1, overflowY: "auto", padding: "10px 0" },
  sectionHead: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 14px", marginBottom: 6 },
  sectionLabel: { fontSize: 10, fontWeight: 700, color: "#5a5478", letterSpacing: 1.2 },
  addBtn: {
    width: 22, height: 22, borderRadius: 6, border: "1px solid rgba(240,184,96,0.2)",
    background: "transparent", color: "#f0b860", fontSize: 14, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
  },
  newProjectForm: { padding: "8px 14px", display: "flex", flexDirection: "column", gap: 6 },
  formInput: {
    padding: "7px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)", color: "#e0d8f0", fontSize: 12,
    fontFamily: "'DM Sans', sans-serif",
  },
  formSelect: {
    padding: "7px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)",
    background: "#0c0a14", color: "#e0d8f0", fontSize: 12,
    fontFamily: "'DM Sans', sans-serif",
  },
  formBtnPrimary: {
    flex: 1, padding: "6px 0", borderRadius: 6, border: "none",
    background: "linear-gradient(135deg, #f0b860, #d4943a)", color: "#0c0a14",
    fontSize: 12, fontWeight: 700, cursor: "pointer",
  },
  formBtnSecondary: {
    flex: 1, padding: "6px 0", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)",
    background: "transparent", color: "#8a7faa", fontSize: 12, cursor: "pointer",
  },
  projectList: { display: "flex", flexDirection: "column", gap: 1, padding: "0 8px" },
  projectItem: {
    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
    borderRadius: 8, border: "1px solid transparent", background: "transparent",
    cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.15s",
  },
  projectItemActive: { background: "rgba(240,184,96,0.06)", border: "1px solid rgba(240,184,96,0.12)" },
  projIcon: { fontSize: 16, flexShrink: 0 },
  projInfo: { flex: 1, minWidth: 0 },
  projName: { fontSize: 13, fontWeight: 500, color: "#e0d8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  projMeta: { fontSize: 10, color: "#5a5478" },
  refBadge: { fontSize: 10, color: "#4ade80", background: "rgba(74,222,128,0.1)", padding: "1px 5px", borderRadius: 4 },
  sidebarNav: { padding: "8px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", flexDirection: "column", gap: 2 },
  navBtn: {
    padding: "8px 12px", borderRadius: 8, border: "none", background: "transparent",
    color: "#8a7faa", fontSize: 12.5, cursor: "pointer", textAlign: "left", transition: "all 0.15s",
  },
  navBtnActive: { background: "rgba(240,184,96,0.06)", color: "#f0b860" },
  sidebarFooter: { padding: "8px 14px", borderTop: "1px solid rgba(255,255,255,0.03)", textAlign: "center" },

  // Main
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  topBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)",
    background: "rgba(12,10,20,0.8)", backdropFilter: "blur(12px)", zIndex: 5,
  },
  topLeft: { display: "flex", alignItems: "center", gap: 10 },
  sidebarToggle: {
    width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)",
    background: "transparent", color: "#8a7faa", fontSize: 14, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  topTitle: { fontSize: 16, fontWeight: 700, color: "#f0b860", fontFamily: "'JetBrains Mono', monospace" },
  topSub: { fontSize: 11, color: "#6a6088" },
  topRight: { display: "flex", alignItems: "center", gap: 12 },
  decisionBadge: {
    display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1,
    padding: "4px 10px", borderRadius: 8, background: "rgba(240,184,96,0.05)",
    border: "1px solid rgba(240,184,96,0.1)",
  },
  duckyMood: { fontSize: 24 },

  // Chat
  chatArea: { flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, textAlign: "center" },
  emptyTitle: { fontSize: 20, fontWeight: 700, color: "#f0b860", fontFamily: "'JetBrains Mono', monospace" },
  emptyText: { fontSize: 13, color: "#8a7faa", marginTop: 4, maxWidth: 420 },
  templateGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 20, maxWidth: 500 },
  templateCard: {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3,
    padding: 12, borderRadius: 10, border: "1px solid rgba(240,184,96,0.08)",
    background: "rgba(240,184,96,0.02)", cursor: "pointer", textAlign: "left",
    fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
  },
  tplName: { fontSize: 12.5, fontWeight: 600, color: "#e0d8f0" },
  tplDesc: { fontSize: 10.5, color: "#6a6088", lineHeight: 1.3 },
  msgRow: { display: "flex", alignItems: "flex-start", gap: 8 },
  msgAvatar: {
    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
    background: "linear-gradient(135deg, #f0b860, #d4943a)",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, marginTop: 2,
  },
  userBubble: {
    maxWidth: "70%", padding: "10px 14px", borderRadius: "12px 12px 3px 12px",
    background: "linear-gradient(135deg, rgba(240,184,96,0.12), rgba(240,184,96,0.06))",
    border: "1px solid rgba(240,184,96,0.12)", fontSize: 13.5, lineHeight: 1.5, color: "#f0e8d8",
  },
  aiBubble: {
    maxWidth: "80%", padding: "12px 16px", borderRadius: "3px 12px 12px 12px",
    background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)",
    fontSize: 13.5, lineHeight: 1.55, color: "#d0c8e0",
  },
  refTag: { display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" },
  refChip: {
    fontSize: 10, padding: "2px 7px", borderRadius: 4,
    background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)", color: "#4ade80",
  },
  modelTag: {
    display: "flex", alignItems: "center", gap: 5, marginTop: 8, paddingTop: 6,
    borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 10.5, color: "#6a6088",
  },
  modelTagDot: { width: 6, height: 6, borderRadius: "50%", background: "#4ade80", flexShrink: 0 },
  reasoningHint: { fontStyle: "italic", color: "#4a4468" },
  dots: { display: "flex", gap: 5, padding: "4px 0" },
  dot: { width: 7, height: 7, borderRadius: "50%", background: "#f0b860", animation: "pulse 1s infinite" },

  // Code blocks
  codeBlock: { margin: "8px 0", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(240,184,96,0.1)", background: "#08060f" },
  codeHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "5px 10px", background: "rgba(240,184,96,0.05)", borderBottom: "1px solid rgba(240,184,96,0.06)",
  },
  codeLang: { fontSize: 10, fontWeight: 700, color: "#f0b860", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" },
  copyBtn: {
    padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(240,184,96,0.15)",
    background: "transparent", color: "#d4c09a", fontSize: 10, cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  codePre: { padding: "10px 12px", fontSize: 12, lineHeight: 1.5, overflowX: "auto", fontFamily: "'JetBrains Mono', monospace", color: "#c0b8d0", margin: 0 },
  h2: { fontSize: 17, fontWeight: 700, color: "#f0b860", margin: "12px 0 4px", fontFamily: "'JetBrains Mono', monospace" },
  h3: { fontSize: 14, fontWeight: 600, color: "#e0d8f0", margin: "10px 0 3px" },
  h4: { fontSize: 12.5, fontWeight: 600, color: "#c0b8d0", margin: "6px 0 3px" },
  li: { fontSize: 13, color: "#b8b0c8", paddingLeft: 10, lineHeight: 1.5 },
  p: { fontSize: 13, color: "#c0b8d0", lineHeight: 1.55, margin: "2px 0" },

  // Ref panel
  refPanel: {
    padding: "10px 20px", borderTop: "1px solid rgba(74,222,128,0.1)",
    background: "rgba(74,222,128,0.02)", animation: "fadeIn 0.2s ease-out",
  },
  refPanelHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  refClose: {
    width: 22, height: 22, borderRadius: 4, border: "none",
    background: "rgba(255,255,255,0.05)", color: "#8a7faa", fontSize: 12, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  refList: { display: "flex", flexDirection: "column", gap: 3 },
  refItem: {
    display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
    borderRadius: 6, border: "1px solid rgba(255,255,255,0.04)", background: "transparent",
    cursor: "pointer", fontSize: 12, color: "#d0c8e0", fontFamily: "'DM Sans', sans-serif",
    textAlign: "left", width: "100%", transition: "all 0.15s",
  },
  refItemActive: { border: "1px solid rgba(74,222,128,0.2)", background: "rgba(74,222,128,0.04)" },

  // Task bar
  taskBar: {
    display: "flex", gap: 3, padding: "6px 20px", overflowX: "auto",
    borderTop: "1px solid rgba(255,255,255,0.03)", background: "rgba(12,10,20,0.5)",
  },
  taskTab: {
    padding: "5px 10px", borderRadius: 6, border: "1px solid transparent",
    background: "transparent", color: "#5a5478", fontSize: 11.5, cursor: "pointer",
    whiteSpace: "nowrap", transition: "all 0.15s",
  },
  taskTabActive: { border: "1px solid rgba(240,184,96,0.2)", color: "#f0b860", background: "rgba(240,184,96,0.04)" },

  // Input
  inputArea: { padding: "8px 20px 10px", background: "rgba(12,10,20,0.9)", borderTop: "1px solid rgba(240,184,96,0.06)" },
  inputRow: { display: "flex", gap: 8, alignItems: "flex-end" },
  refToggle: {
    width: 36, height: 36, borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)",
    background: "transparent", color: "#6a6088", fontSize: 14, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  refToggleActive: { border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", background: "rgba(74,222,128,0.04)" },
  input: {
    flex: 1, padding: "9px 12px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.025)",
    color: "#e0d8f0", fontSize: 13.5, fontFamily: "'DM Sans', sans-serif",
    resize: "none", lineHeight: 1.45, transition: "all 0.2s",
  },
  sendBtn: {
    padding: "9px 20px", borderRadius: 8, border: "none",
    background: "linear-gradient(135deg, #f0b860, #d4943a)", color: "#0c0a14",
    fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
    boxShadow: "0 2px 10px rgba(240,184,96,0.25)", flexShrink: 0, transition: "all 0.2s",
  },
  sendBtnOff: { opacity: 0.35, cursor: "not-allowed", boxShadow: "none" },

  // Setup view
  setupView: { flex: 1, overflowY: "auto", padding: 20 },
  setupHeader: { marginBottom: 20 },
  setupTitle: { fontSize: 18, fontWeight: 700, color: "#f0b860", fontFamily: "'JetBrains Mono', monospace" },
  setupDesc: { fontSize: 13, color: "#8a7faa", marginTop: 4 },
  platformGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 },
  platformCard: {
    padding: 16, borderRadius: 12, border: "1px solid",
    background: "rgba(255,255,255,0.015)",
  },
  platHead: { display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14 },
  stepList: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 },
  stepRow: { display: "flex", alignItems: "center", gap: 8 },
  stepDot: {
    width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center",
    justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#e0d8f0", flexShrink: 0,
  },
  stepBadges: { display: "flex", gap: 4, alignItems: "center" },
  autoBadge: { fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "rgba(74,222,128,0.1)", color: "#4ade80" },
  manualBadge: { fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "rgba(249,115,22,0.1)", color: "#f97316" },
  runStepBtn: {
    fontSize: 10, padding: "2px 8px", borderRadius: 4,
    border: "1px solid rgba(240,184,96,0.2)", background: "transparent",
    color: "#f0b860", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  platActions: { display: "flex", gap: 8, alignItems: "center" },
  autoAllBtn: {
    flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid",
    fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  signupLink: {
    fontSize: 12, color: "#8a7faa", textDecoration: "none", padding: "8px 12px",
    borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)",
  },

  // Config view
  configView: { flex: 1, overflowY: "auto", padding: 20 },
  configHeader: { marginBottom: 20 },
  configTitle: { fontSize: 18, fontWeight: 700, color: "#f0b860", fontFamily: "'JetBrains Mono', monospace" },
  configDesc: { fontSize: 13, color: "#8a7faa", marginTop: 4, lineHeight: 1.5 },
  duckyNote: {
    display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px",
    borderRadius: 10, background: "rgba(240,184,96,0.04)", border: "1px solid rgba(240,184,96,0.1)",
    marginTop: 12, lineHeight: 1.45,
  },
  archDiagram: {
    marginTop: 14, padding: "14px 16px", borderRadius: 10,
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
  },
  archFlow: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 10,
  },
  archNode: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    padding: "10px 16px", borderRadius: 8, background: "rgba(240,184,96,0.05)",
    border: "1px solid rgba(240,184,96,0.12)",
  },
  archLabel: { fontSize: 13, fontWeight: 700, color: "#f0b860", fontFamily: "'JetBrains Mono', monospace" },
  archRole: { fontSize: 10, color: "#6a6088" },
  archArrow: { fontSize: 20, color: "#4a4468", fontWeight: 700 },
  archForbidden: {
    display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
    fontSize: 11, color: "#8a7faa", padding: "6px 0 0",
    borderTop: "1px solid rgba(255,255,255,0.04)",
  },
  configGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 20 },
  configCard: {
    padding: 14, borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)",
    background: "rgba(255,255,255,0.015)",
  },
  configLabel: { fontSize: 11, color: "#6a6088", marginBottom: 4, display: "block" },
  configSelect: {
    width: "100%", padding: "6px 8px", borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.08)", background: "#0c0a14",
    color: "#e0d8f0", fontSize: 12, fontFamily: "'DM Sans', sans-serif",
  },
  configMeta: { fontSize: 10.5, color: "#5a5478", marginTop: 6 },
  modelInfo: {
    padding: 16, borderRadius: 12, border: "1px solid rgba(240,184,96,0.08)",
    background: "rgba(240,184,96,0.02)",
  },
  modelRow: {
    padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)",
  },

  // Footer
  footer: {
    display: "flex", justifyContent: "center", gap: 8,
    padding: "6px 20px", fontSize: 10, color: "#3a3458",
    borderTop: "1px solid rgba(255,255,255,0.02)",
  },
};
