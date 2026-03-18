/**
 * CVGBuilder v3 Plan Mode — /build route
 *
 * Multi-step wizard for generating BuildPlan objects:
 * 1. Overview (name, description, app code)
 * 2. Agent Graph (steps, types, dependencies)
 * 3. Tools (connector selection)
 * 4. Schema (entity definitions)
 * 5. RBAC (role-permission matrix)
 * 6. Review (preview + generate test scenarios)
 */

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DuckyAnimation } from "@cavaridge/ducky-animations";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Check,
  Loader2,
  FileCode2,
  Save,
  Sparkles,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────

interface AgentNode {
  id: string;
  type: "read" | "reason" | "write";
  description: string;
  dependsOn: string[];
}

interface SchemaField {
  name: string;
  type: string;
  nullable: boolean;
}

interface SchemaEntity {
  name: string;
  fields: SchemaField[];
}

interface BuildPlanDraft {
  name: string;
  description: string;
  appCode: string;
  agentNodes: AgentNode[];
  tools: string[];
  entities: SchemaEntity[];
  rbac: Record<string, string[]>;
}

// ── Available connectors/tools ────────────────────────────────────────

const AVAILABLE_TOOLS = [
  { id: "spaniel", name: "Spaniel (LLM Gateway)", category: "Core" },
  { id: "github", name: "GitHub", category: "Development" },
  { id: "gitlab", name: "GitLab", category: "Development" },
  { id: "jira", name: "Jira", category: "ITSM" },
  { id: "slack", name: "Slack", category: "Collaboration" },
  { id: "notion", name: "Notion", category: "Collaboration" },
  { id: "google_workspace", name: "Google Workspace", category: "Collaboration" },
  { id: "microsoft_365", name: "Microsoft 365", category: "Collaboration" },
  { id: "salesforce", name: "Salesforce", category: "CRM" },
  { id: "hubspot", name: "HubSpot", category: "CRM" },
  { id: "stripe", name: "Stripe", category: "Finance" },
  { id: "ninjaone", name: "NinjaOne", category: "MSP" },
  { id: "halopsa", name: "HaloPSA", category: "MSP" },
];

const RBAC_ROLES = ["platform_admin", "tenant_admin", "user", "viewer"] as const;
const FIELD_TYPES = ["uuid", "text", "varchar", "integer", "boolean", "jsonb", "timestamp", "numeric"] as const;

const STEPS = ["Overview", "Agent Graph", "Tools", "Schema", "RBAC", "Review"] as const;

// ── Component ─────────────────────────────────────────────────────────

export default function BuildPage() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<BuildPlanDraft>({
    name: "",
    description: "",
    appCode: "",
    agentNodes: [],
    tools: ["spaniel"],
    entities: [],
    rbac: {
      platform_admin: [],
      tenant_admin: [],
      user: [],
      viewer: [],
    },
  });

  // Load existing plans
  const { data: existingPlans } = useQuery<any[]>({
    queryKey: ["/api/build/plans"],
    queryFn: async () => {
      const res = await fetch("/api/build/plans", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: draft.name,
        description: draft.description || undefined,
        agentGraph: {
          nodes: draft.agentNodes,
          edges: draft.agentNodes.flatMap((n) =>
            n.dependsOn.map((dep) => ({ from: dep, to: n.id })),
          ),
        },
        toolDefinitions: draft.tools.map((t) => ({
          id: t,
          name: AVAILABLE_TOOLS.find((at) => at.id === t)?.name || t,
          type: "connector",
        })),
        schemaTemplate: {
          tables: draft.entities.map((e) => ({
            name: e.name,
            columns: [
              { name: "id", type: "uuid", nullable: false },
              { name: "tenant_id", type: "uuid", nullable: false, references: "organizations.id" },
              ...e.fields,
            ],
          })),
        },
        rbacMatrix: {
          roles: Object.entries(draft.rbac).map(([role, perms]) => ({ role, permissions: perms })),
        },
      };
      const res = await apiRequest("POST", "/api/build/plan", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/build/plans"] });
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: draft.name || "Untitled Draft",
        description: draft.description || undefined,
        agentGraph: { nodes: draft.agentNodes },
        toolDefinitions: draft.tools.map((t) => ({ id: t })),
        schemaTemplate: { tables: draft.entities },
        rbacMatrix: { roles: Object.entries(draft.rbac).map(([role, perms]) => ({ role, permissions: perms })) },
      };
      const res = await apiRequest("POST", "/api/build/plan", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/build/plans"] });
    },
  });

  // ── Agent node helpers ──────────────────────────────────────────────

  const addNode = () => {
    const id = `step-${Date.now()}`;
    setDraft((d) => ({
      ...d,
      agentNodes: [...d.agentNodes, { id, type: "read", description: "", dependsOn: [] }],
    }));
  };

  const removeNode = (id: string) => {
    setDraft((d) => ({
      ...d,
      agentNodes: d.agentNodes
        .filter((n) => n.id !== id)
        .map((n) => ({ ...n, dependsOn: n.dependsOn.filter((dep) => dep !== id) })),
    }));
  };

  const updateNode = (id: string, updates: Partial<AgentNode>) => {
    setDraft((d) => ({
      ...d,
      agentNodes: d.agentNodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }));
  };

  // ── Schema entity helpers ──────────────────────────────────────────

  const addEntity = () => {
    setDraft((d) => ({
      ...d,
      entities: [...d.entities, { name: "", fields: [{ name: "", type: "text", nullable: false }] }],
    }));
  };

  const removeEntity = (idx: number) => {
    setDraft((d) => ({ ...d, entities: d.entities.filter((_, i) => i !== idx) }));
  };

  const updateEntity = (idx: number, updates: Partial<SchemaEntity>) => {
    setDraft((d) => ({
      ...d,
      entities: d.entities.map((e, i) => (i === idx ? { ...e, ...updates } : e)),
    }));
  };

  const addField = (entityIdx: number) => {
    setDraft((d) => ({
      ...d,
      entities: d.entities.map((e, i) =>
        i === entityIdx ? { ...e, fields: [...e.fields, { name: "", type: "text", nullable: false }] } : e,
      ),
    }));
  };

  const updateField = (entityIdx: number, fieldIdx: number, updates: Partial<SchemaField>) => {
    setDraft((d) => ({
      ...d,
      entities: d.entities.map((e, i) =>
        i === entityIdx
          ? { ...e, fields: e.fields.map((f, fi) => (fi === fieldIdx ? { ...f, ...updates } : f)) }
          : e,
      ),
    }));
  };

  const removeField = (entityIdx: number, fieldIdx: number) => {
    setDraft((d) => ({
      ...d,
      entities: d.entities.map((e, i) =>
        i === entityIdx ? { ...e, fields: e.fields.filter((_, fi) => fi !== fieldIdx) } : e,
      ),
    }));
  };

  // ── RBAC helpers ───────────────────────────────────────────────────

  const togglePermission = (role: string, perm: string) => {
    setDraft((d) => ({
      ...d,
      rbac: {
        ...d.rbac,
        [role]: d.rbac[role]?.includes(perm)
          ? d.rbac[role].filter((p) => p !== perm)
          : [...(d.rbac[role] || []), perm],
      },
    }));
  };

  // Derive permissions from agent nodes + entities
  const derivedPermissions = [
    ...draft.agentNodes.map((n) => `${n.type}_${n.id.replace(/[^a-z0-9]/g, "_")}`),
    ...draft.entities.map((e) => `manage_${e.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`),
    "view_dashboard",
    "manage_settings",
  ].filter(Boolean);

  // ── Render steps ───────────────────────────────────────────────────

  const inputClasses = "w-full bg-[var(--bg-card)] border border-[var(--theme-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-amber-500/30";
  const labelClasses = "block text-xs font-medium text-[var(--text-secondary)] mb-1";
  const cardClasses = "bg-[var(--bg-card)] border border-[var(--theme-border)] rounded-xl p-4";

  const renderStep = () => {
    switch (step) {
      case 0: // Overview
        return (
          <div className="space-y-4">
            <div>
              <label className={labelClasses}>Plan Name</label>
              <input
                className={inputClasses}
                placeholder="e.g., HIPAA Risk Assessment Agent"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClasses}>Description</label>
              <textarea
                className={`${inputClasses} h-24 resize-none`}
                placeholder="What does this agent/feature do?"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClasses}>App Code (optional)</label>
              <input
                className={inputClasses}
                placeholder="e.g., CVG-HIPAA"
                value={draft.appCode}
                onChange={(e) => setDraft((d) => ({ ...d, appCode: e.target.value }))}
              />
            </div>
          </div>
        );

      case 1: // Agent Graph
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-secondary)]">
                Define agent steps as a DAG. Each step can depend on prior steps.
              </p>
              <button onClick={addNode} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Step
              </button>
            </div>
            {draft.agentNodes.length === 0 && (
              <div className={`${cardClasses} text-center py-8`}>
                <p className="text-sm text-[var(--text-disabled)]">No agent steps defined yet. Click "Add Step" to begin.</p>
              </div>
            )}
            {draft.agentNodes.map((node, idx) => (
              <div key={node.id} className={cardClasses}>
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-amber-500 mt-2">#{idx + 1}</span>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <select
                        className={`${inputClasses} w-32`}
                        value={node.type}
                        onChange={(e) => updateNode(node.id, { type: e.target.value as AgentNode["type"] })}
                      >
                        <option value="read">Read</option>
                        <option value="reason">Reason</option>
                        <option value="write">Write</option>
                      </select>
                      <input
                        className={`${inputClasses} flex-1`}
                        placeholder="Step description"
                        value={node.description}
                        onChange={(e) => updateNode(node.id, { description: e.target.value })}
                      />
                    </div>
                    {idx > 0 && (
                      <div>
                        <label className="text-[10px] text-[var(--text-disabled)]">Depends on:</label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {draft.agentNodes.slice(0, idx).map((prev, pi) => (
                            <button
                              key={prev.id}
                              onClick={() => {
                                const deps = node.dependsOn.includes(prev.id)
                                  ? node.dependsOn.filter((d) => d !== prev.id)
                                  : [...node.dependsOn, prev.id];
                                updateNode(node.id, { dependsOn: deps });
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                                node.dependsOn.includes(prev.id)
                                  ? "bg-amber-500/20 text-amber-600 border border-amber-500/30"
                                  : "bg-[var(--bg-primary)] text-[var(--text-disabled)] border border-[var(--theme-border)]"
                              }`}
                            >
                              #{pi + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button onClick={() => removeNode(node.id)} className="text-[var(--text-disabled)] hover:text-red-400 mt-2">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        );

      case 2: // Tools
        return (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Select connectors and tools this agent will use. Spaniel is always included.
            </p>
            {Object.entries(
              AVAILABLE_TOOLS.reduce((acc, t) => {
                (acc[t.category] = acc[t.category] || []).push(t);
                return acc;
              }, {} as Record<string, typeof AVAILABLE_TOOLS>),
            ).map(([category, tools]) => (
              <div key={category}>
                <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">{category}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {tools.map((tool) => {
                    const selected = draft.tools.includes(tool.id);
                    const isCore = tool.id === "spaniel";
                    return (
                      <button
                        key={tool.id}
                        onClick={() => {
                          if (isCore) return;
                          setDraft((d) => ({
                            ...d,
                            tools: selected
                              ? d.tools.filter((t) => t !== tool.id)
                              : [...d.tools, tool.id],
                          }));
                        }}
                        disabled={isCore}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                          selected
                            ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                            : "bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--theme-border)] hover:border-amber-500/30"
                        } ${isCore ? "opacity-75 cursor-not-allowed" : ""}`}
                      >
                        {selected && <Check className="h-3.5 w-3.5 text-amber-500" />}
                        {tool.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );

      case 3: // Schema
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-secondary)]">
                Define entities. Each table gets <code className="text-amber-500">tenant_id</code> automatically.
              </p>
              <button onClick={addEntity} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Entity
              </button>
            </div>
            {draft.entities.map((entity, ei) => (
              <div key={ei} className={cardClasses}>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    className={`${inputClasses} flex-1 font-mono`}
                    placeholder="table_name (snake_case)"
                    value={entity.name}
                    onChange={(e) => updateEntity(ei, { name: e.target.value })}
                  />
                  <button onClick={() => removeEntity(ei)} className="text-[var(--text-disabled)] hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  <div className="grid grid-cols-[1fr_120px_60px_32px] gap-1 text-[10px] text-[var(--text-disabled)] px-1">
                    <span>Column</span><span>Type</span><span>Null?</span><span></span>
                  </div>
                  {/* Auto-included columns */}
                  <div className="grid grid-cols-[1fr_120px_60px_32px] gap-1 px-1 text-xs text-[var(--text-disabled)] opacity-50">
                    <span className="font-mono">id</span><span>uuid (PK)</span><span></span><span></span>
                  </div>
                  <div className="grid grid-cols-[1fr_120px_60px_32px] gap-1 px-1 text-xs text-[var(--text-disabled)] opacity-50">
                    <span className="font-mono">tenant_id</span><span>uuid (FK)</span><span></span><span></span>
                  </div>
                  {entity.fields.map((field, fi) => (
                    <div key={fi} className="grid grid-cols-[1fr_120px_60px_32px] gap-1">
                      <input
                        className={`${inputClasses} font-mono text-xs py-1`}
                        placeholder="column_name"
                        value={field.name}
                        onChange={(e) => updateField(ei, fi, { name: e.target.value })}
                      />
                      <select
                        className={`${inputClasses} text-xs py-1`}
                        value={field.type}
                        onChange={(e) => updateField(ei, fi, { type: e.target.value })}
                      >
                        {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <label className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={field.nullable}
                          onChange={(e) => updateField(ei, fi, { nullable: e.target.checked })}
                          className="accent-amber-500"
                        />
                      </label>
                      <button onClick={() => removeField(ei, fi)} className="text-[var(--text-disabled)] hover:text-red-400 flex items-center justify-center">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => addField(ei)}
                  className="mt-2 text-xs text-amber-500 hover:text-amber-600"
                >
                  + Add column
                </button>
              </div>
            ))}
          </div>
        );

      case 4: // RBAC
        return (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Assign permissions to roles. Permissions are derived from your agent steps and entities.
            </p>
            {derivedPermissions.length === 0 ? (
              <div className={`${cardClasses} text-center py-8`}>
                <p className="text-sm text-[var(--text-disabled)]">
                  Define agent steps or entities first to generate permissions.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--theme-border)]">
                      <th className="text-left py-2 px-2 text-[var(--text-secondary)] font-medium">Permission</th>
                      {RBAC_ROLES.map((role) => (
                        <th key={role} className="text-center py-2 px-2 text-[var(--text-secondary)] font-medium">
                          {role.replace("_", " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {derivedPermissions.map((perm) => (
                      <tr key={perm} className="border-b border-[var(--theme-border)]/50">
                        <td className="py-2 px-2 font-mono text-[var(--text-primary)]">{perm}</td>
                        {RBAC_ROLES.map((role) => (
                          <td key={role} className="text-center py-2 px-2">
                            <button
                              onClick={() => togglePermission(role, perm)}
                              className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                draft.rbac[role]?.includes(perm)
                                  ? "bg-amber-500 border-amber-500 text-white"
                                  : "border-[var(--theme-border)] hover:border-amber-500/50"
                              }`}
                            >
                              {draft.rbac[role]?.includes(perm) && <Check className="h-3 w-3" />}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      case 5: // Review
        return (
          <div className="space-y-4">
            <div className={cardClasses}>
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">Plan Summary</h4>
              <dl className="space-y-1 text-xs">
                <div className="flex gap-2">
                  <dt className="text-[var(--text-secondary)] w-24">Name:</dt>
                  <dd className="text-[var(--text-primary)]">{draft.name || "—"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-[var(--text-secondary)] w-24">Agent Steps:</dt>
                  <dd className="text-[var(--text-primary)]">{draft.agentNodes.length}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-[var(--text-secondary)] w-24">Tools:</dt>
                  <dd className="text-[var(--text-primary)]">{draft.tools.length}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-[var(--text-secondary)] w-24">Entities:</dt>
                  <dd className="text-[var(--text-primary)]">{draft.entities.length}</dd>
                </div>
              </dl>
            </div>

            {createMutation.isSuccess && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-600">Build plan created</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Spaniel expanded your specification with auto-generated test scenarios. View it in the sidebar.
                </p>
              </div>
            )}

            {createMutation.isError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
              </div>
            )}

            <div className={cardClasses}>
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">Generated BuildPlan Preview</h4>
              <pre className="text-[10px] text-[var(--text-secondary)] overflow-auto max-h-64 bg-[var(--bg-primary)] rounded-lg p-3 font-mono">
                {JSON.stringify(
                  {
                    name: draft.name,
                    description: draft.description,
                    agentGraph: { nodes: draft.agentNodes },
                    tools: draft.tools,
                    schema: draft.entities.map((e) => ({
                      ...e,
                      autoColumns: ["id (uuid PK)", "tenant_id (uuid FK NOT NULL)"],
                    })),
                    rbac: draft.rbac,
                    testScenarios: "— auto-generated by Spaniel on submit —",
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = step === 0 ? draft.name.trim().length > 0 : true;

  return (
    <div className="flex h-full">
      {/* Sidebar — existing plans */}
      <div className="w-56 border-r border-[var(--theme-border)] bg-[var(--sidebar-bg)] flex flex-col">
        <div className="p-3 border-b border-[var(--theme-border)]">
          <h3 className="text-xs font-medium text-[var(--text-secondary)]">Build Plans</h3>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {existingPlans?.map((p: any) => (
            <div
              key={p.id}
              className="px-3 py-2 rounded-lg text-xs hover:bg-[var(--bg-card)] cursor-pointer transition-colors"
            >
              <p className="text-[var(--text-primary)] font-medium truncate">{p.name}</p>
              <p className="text-[10px] text-[var(--text-disabled)]">{p.status}</p>
            </div>
          ))}
          {(!existingPlans || existingPlans.length === 0) && (
            <p className="text-[10px] text-[var(--text-disabled)] text-center py-4">No plans yet</p>
          )}
        </div>
      </div>

      {/* Main wizard area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--theme-border)]">
          <div className="flex items-center gap-3">
            <DuckyAnimation state={createMutation.isPending ? "thinking" : "idle"} size="sm" />
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">CVGBuilder v3</h2>
              <p className="text-xs text-[var(--text-secondary)]">Plan Mode</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => saveDraftMutation.mutate()}
              disabled={!draft.name.trim() || saveDraftMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-secondary)] border border-[var(--theme-border)] rounded-lg hover:bg-[var(--bg-card)] transition-colors disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              Save Draft
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-[var(--theme-border)]">
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                i === step
                  ? "bg-amber-500 text-white"
                  : i < step
                    ? "bg-amber-500/10 text-amber-600"
                    : "text-[var(--text-disabled)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">
            {renderStep()}
          </div>
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--theme-border)]">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              disabled={!canProceed}
              className="flex items-center gap-1 px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !draft.name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate Build Plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
