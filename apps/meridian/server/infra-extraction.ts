import { chatCompletion, hasAICapability } from "./openrouter";
import { storage } from "./storage";
import type { InsertTechStackItem, InsertTopologyNode, InsertTopologyConnection, InsertBaselineComparison, InsertPlaybookPhase, InsertPlaybookTask } from "@shared/schema";

const TECH_STACK_CATEGORIES = [
  "Identity & Access", "Networking", "Security", "Backup & DR",
  "Productivity", "EHR / Clinical", "Line of Business Apps",
  "Cloud Services", "Endpoints", "Telephony", "Monitoring", "Other"
];

function ensureAI() {
  if (!hasAICapability()) {
    throw new Error("OPENROUTER_API_KEY is required for infrastructure extraction");
  }
}

async function gatherDealText(dealId: string): Promise<{ text: string; documentIds: string[] }> {
  const documents = await storage.getDocumentsByDeal(dealId);
  const documentIds: string[] = [];
  const textParts: string[] = [];

  for (const doc of documents) {
    if (doc.extractedText && doc.extractedText.trim().length > 0) {
      documentIds.push(doc.id);
      textParts.push(`--- Document: ${doc.filename} (${doc.classification || "unclassified"}) ---\n${doc.extractedText.slice(0, 8000)}`);
    }
    if (doc.metadataJson && typeof doc.metadataJson === "object") {
      const meta = doc.metadataJson as Record<string, any>;
      if (meta.visionDescription) {
        if (!documentIds.includes(doc.id)) documentIds.push(doc.id);
        textParts.push(`--- Vision Analysis: ${doc.filename} ---\n${meta.visionDescription}`);
      }
    }
  }

  return { text: textParts.join("\n\n").slice(0, 60000), documentIds };
}

export async function extractTechStack(dealId: string): Promise<{ count: number }> {
  ensureAI();
  const { text, documentIds } = await gatherDealText(dealId);

  if (!text.trim()) {
    return { count: 0 };
  }

  const responseText = await chatCompletion({
    task: "infraExtraction",
    maxTokens: 4096,
    messages: [{
      role: "user",
      content: `You are analyzing IT due diligence documents for a mergers & acquisitions assessment. Extract every technology, product, platform, and service mentioned in the following document text.

For each technology detected, provide:
- category: one of [${TECH_STACK_CATEGORIES.join(", ")}]
- item_name: the product/technology name
- version: version number if mentioned (null if not)
- status: "current", "eol" (end of life), "deprecated", or "unknown"
- notes: brief context (how it's used, any concerns mentioned)
- confidence: "high", "medium", or "low" based on how clearly it was stated

Respond as a JSON array. Deduplicate — if the same technology appears in multiple documents, combine the information into one entry with the highest confidence. Flag version conflicts if different documents show different versions.

IMPORTANT: Respond with ONLY a valid JSON array, no other text.

Document text:
${text}`
    }],
  });

  let items: any[] = [];
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      items = JSON.parse(jsonMatch[0]);
    }
  } catch {
    console.error("Failed to parse tech stack extraction response");
    return { count: 0 };
  }

  await storage.deleteTechStackByDeal(dealId);

  const insertItems: InsertTechStackItem[] = items.map((item: any) => ({
    dealId,
    category: TECH_STACK_CATEGORIES.includes(item.category) ? item.category : "Other",
    itemName: String(item.item_name || item.itemName || "Unknown"),
    version: item.version || null,
    status: ["current", "eol", "deprecated", "unknown"].includes(item.status) ? item.status : "unknown",
    notes: item.notes || null,
    confidence: ["high", "medium", "low"].includes(item.confidence) ? item.confidence : "medium",
    sourceDocumentId: documentIds[0] || null,
  }));

  if (insertItems.length > 0) {
    await storage.insertTechStackItems(insertItems);
  }

  return { count: insertItems.length };
}

export async function extractTopology(dealId: string): Promise<{ nodeCount: number; connectionCount: number }> {
  ensureAI();
  const { text, documentIds } = await gatherDealText(dealId);

  if (!text.trim()) {
    return { nodeCount: 0, connectionCount: 0 };
  }

  const responseText = await chatCompletion({
    task: "infraExtraction",
    maxTokens: 4096,
    messages: [{
      role: "user",
      content: `You are analyzing IT infrastructure documents for an M&A assessment. Reconstruct the network topology from the information provided.

Identify:
- Facilities/sites (name, location if mentioned, status)
- Network devices (firewalls, switches, routers — brand/model if mentioned)
- Servers and datacenters
- Cloud services
- WAN/Internet connections between sites
- VPN tunnels
- The acquirer's environment (if described)
- The target's environment

For each node, indicate:
- node_type: acquirer, target_hq, facility, datacenter, cloud, firewall, switch, server, wan_link, vpn, internet
- label: display name
- sublabel: brief status note (e.g., "Flat network", "Segmented", "No MDF")
- status: healthy, warning, critical, unknown
- parent: label of parent node (null for top-level)

For each connection between nodes:
- from: label of source node
- to: label of target node
- connection_type: wan, lan, vpn, internet, trunk, fiber, wireless
- bandwidth: if mentioned
- label: description
- status: healthy, warning, critical, unknown

Respond as JSON:
{
  "nodes": [...],
  "connections": [...],
  "summary": "Brief topology description"
}

If information is insufficient, provide what you can and mark unknowns.
IMPORTANT: Respond with ONLY valid JSON, no other text.

Document text:
${text}`
    }],
  });

  let parsed: { nodes: any[]; connections: any[]; summary?: string } = { nodes: [], connections: [] };
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch {
    console.error("Failed to parse topology extraction response");
    return { nodeCount: 0, connectionCount: 0 };
  }

  await storage.deleteTopologyByDeal(dealId);

  const nodeTypeValues = ["acquirer", "target_hq", "facility", "datacenter", "cloud", "firewall", "switch", "server", "wan_link", "vpn", "internet"];
  const connectionTypeValues = ["wan", "lan", "vpn", "internet", "trunk", "fiber", "wireless"];
  const statusValues = ["healthy", "warning", "critical", "unknown"];

  const layerOrder: Record<string, number> = {
    acquirer: 0, internet: 0, cloud: 1,
    target_hq: 2, datacenter: 2,
    firewall: 3, switch: 3, server: 3, vpn: 3, wan_link: 3,
    facility: 4,
  };

  const nodeInserts: InsertTopologyNode[] = (parsed.nodes || []).map((n: any, i: number) => {
    const nodeType = nodeTypeValues.includes(n.node_type) ? n.node_type : "server";
    const layer = layerOrder[nodeType] ?? 3;
    return {
      dealId,
      nodeType,
      label: String(n.label || `Node ${i + 1}`),
      sublabel: n.sublabel || null,
      status: statusValues.includes(n.status) ? n.status : "unknown",
      parentNodeId: null,
      positionX: i * 160,
      positionY: layer * 140,
      metadataJson: n.metadata || null,
      sourceDocumentId: documentIds[0] || null,
    };
  });

  let insertedNodes: any[] = [];
  if (nodeInserts.length > 0) {
    insertedNodes = await storage.insertTopologyNodes(nodeInserts);
  }

  const labelToId: Record<string, string> = {};
  insertedNodes.forEach((n: any) => { labelToId[n.label] = n.id; });

  const connInserts: InsertTopologyConnection[] = (parsed.connections || [])
    .filter((c: any) => labelToId[c.from] && labelToId[c.to])
    .map((c: any) => ({
      dealId,
      fromNodeId: labelToId[c.from],
      toNodeId: labelToId[c.to],
      connectionType: connectionTypeValues.includes(c.connection_type) ? c.connection_type : "lan",
      label: c.label || null,
      bandwidth: c.bandwidth || null,
      status: statusValues.includes(c.status) ? c.status : "healthy",
    }));

  if (connInserts.length > 0) {
    await storage.insertTopologyConnections(connInserts);
  }

  for (const rawNode of (parsed.nodes || [])) {
    if (rawNode.parent && labelToId[rawNode.parent] && labelToId[rawNode.label]) {
      const nodeId = labelToId[rawNode.label];
      const parentId = labelToId[rawNode.parent];
      await storage.getTopologyNodesByDeal(dealId);
    }
  }

  return { nodeCount: insertedNodes.length, connectionCount: connInserts.length };
}

function normalizeProfileData(profileData: any): string {
  if (!profileData || typeof profileData !== "object") return "{}";
  const normalized: Record<string, any[]> = {};
  for (const [category, items] of Object.entries(profileData)) {
    if (!Array.isArray(items)) continue;
    normalized[category] = items.map((item: any) => {
      if (typeof item === "string") return { name: item, priority: "recommended" };
      const value = item.value || item.name || String(item);
      const priority = item.priority || (item.required ? "required" : "recommended");
      return { name: value, version: item.version, priority };
    });
  }
  return JSON.stringify(normalized, null, 2);
}

export async function compareBaseline(dealId: string, organizationId: string): Promise<{ count: number }> {
  ensureAI();

  const profiles = await storage.getBaselineProfiles(organizationId);
  const defaultProfile = profiles.find(p => p.isDefault) || profiles[0];

  if (!defaultProfile) {
    return { count: 0 };
  }

  const techStack = await storage.getTechStackByDeal(dealId);
  const findings = await storage.getFindingsByDeal(dealId);

  const techStackSummary = techStack.map(t => `${t.category}: ${t.itemName} (${t.status}, confidence: ${t.confidence})`).join("\n");
  const findingsSummary = findings.slice(0, 30).map(f => `[${f.severity}] ${f.title}`).join("\n");
  const profileData = normalizeProfileData(defaultProfile.profileData);

  const responseText = await chatCompletion({
    task: "infraExtraction",
    maxTokens: 4096,
    messages: [{
      role: "user",
      content: `Compare this target company's detected IT environment against the acquirer's baseline standards. Identify gaps.

Each baseline standard has a priority level that MUST influence your gap severity assessment:

REQUIRED standards:
  - If missing or non-compliant → gap_severity = "critical"
  - If partially compliant → gap_severity = "high"
  - These are dealbreakers if not addressed

RECOMMENDED standards:
  - If missing or non-compliant → gap_severity = "high"
  - If partially compliant → gap_severity = "medium"
  - Important but not dealbreakers

OPTIONAL standards:
  - If missing → gap_severity = "low"
  - If partially compliant → gap_severity = "low"
  - Nice-to-have improvements

Acquirer Baseline Standards (with priorities):
${profileData}

Target Detected Technology:
${techStackSummary}

Target Findings:
${findingsSummary}

For each baseline requirement, assess:
- standard_name: the acquirer's requirement
- priority: the priority level from the baseline (required, recommended, or optional)
- current_state: what the target currently has
- gap_severity: critical, high, medium, low, or "aligned" (meets standard) — use priority rules above
- remediation_note: brief note on what's needed to close the gap
- estimated_cost: rough cost estimate if possible (as text like "$5,000-$10,000")

Respond as a JSON array sorted by priority (required first, then recommended, then optional), then by gap_severity (critical first within each priority group).
IMPORTANT: Respond with ONLY a valid JSON array, no other text.`
    }],
  });

  let items: any[] = [];
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      items = JSON.parse(jsonMatch[0]);
    }
  } catch {
    console.error("Failed to parse baseline comparison response");
    return { count: 0 };
  }

  await storage.deleteBaselineComparisonsByDeal(dealId);

  const validSeverities = ["critical", "high", "medium", "low", "aligned"];
  const validPriorities = ["required", "recommended", "optional"];
  const insertItems: InsertBaselineComparison[] = items.map((item: any) => ({
    dealId,
    standardName: String(item.standard_name || item.standardName || "Unknown Standard"),
    currentState: String(item.current_state || item.currentState || "Unknown"),
    gapSeverity: validSeverities.includes(item.gap_severity || item.gapSeverity) ? (item.gap_severity || item.gapSeverity) : "medium",
    priority: validPriorities.includes(item.priority) ? item.priority : "recommended",
    remediationNote: item.remediation_note || item.remediationNote || null,
    estimatedCost: item.estimated_cost || item.estimatedCost || null,
    sourceDocumentId: null,
  }));

  if (insertItems.length > 0) {
    await storage.insertBaselineComparisons(insertItems);
  }

  return { count: insertItems.length };
}

export async function generatePlaybook(dealId: string): Promise<{ phaseCount: number; taskCount: number }> {
  ensureAI();
  const { text } = await gatherDealText(dealId);

  const techStack = await storage.getTechStackByDeal(dealId);
  const comparisons = await storage.getBaselineComparisonsByDeal(dealId);
  const findings = await storage.getFindingsByDeal(dealId);

  const contextParts: string[] = [];
  if (text.trim()) {
    contextParts.push(`DOCUMENT TEXT:\n${text.slice(0, 20000)}`);
  }
  if (techStack.length > 0) {
    contextParts.push(`DETECTED TECH STACK:\n${techStack.map(t => `- ${t.category}: ${t.itemName} (${t.status}, ${t.version || "no version"})`).join("\n")}`);
  }
  if (comparisons.length > 0) {
    contextParts.push(`BASELINE GAPS:\n${comparisons.filter(c => c.gapSeverity !== "aligned").map(c => `- ${c.standardName}: ${c.gapSeverity} gap - ${c.currentState} (${c.remediationNote || "no remediation note"})`).join("\n")}`);
  }
  if (findings.length > 0) {
    const openFindings = findings.filter(f => f.status === "open" || f.status === "acknowledged");
    contextParts.push(`OPEN FINDINGS:\n${openFindings.slice(0, 20).map(f => `- [${f.severity}] ${f.title}`).join("\n")}`);
  }

  if (contextParts.length === 0) {
    return { phaseCount: 0, taskCount: 0 };
  }

  const responseText = await chatCompletion({
    task: "infraExtraction",
    maxTokens: 4096,
    messages: [{
      role: "user",
      content: `You are an M&A IT integration expert. Based on the following deal intelligence, generate a structured integration playbook with phases and tasks.

${contextParts.join("\n\n")}

Generate 4-6 integration phases, each with 3-7 tasks. Phases should follow a logical M&A IT integration sequence:
1. Pre-Close / Discovery (Day 1-30)
2. Day-1 Readiness (Day 1-14)
3. Infrastructure Migration (Day 15-60)
4. Application Integration (Day 30-90)
5. Security & Compliance Hardening (Day 30-75)
6. Steady State & Optimization (Day 60-120)

Respond as a JSON object with this structure:
{
  "phases": [
    {
      "phase_name": "string",
      "time_range": "Day X-Y",
      "status": "pending",
      "tasks": [
        {
          "task_name": "string - be specific to the actual tech found",
          "is_critical_path": boolean,
          "status": "pending"
        }
      ]
    }
  ]
}

Make tasks SPECIFIC to the technologies and gaps found. Reference actual products/vendors when possible.
IMPORTANT: Respond with ONLY a valid JSON object, no other text.`
    }],
  });

  let parsed: any;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch {
    console.error("Failed to parse playbook response");
    return { phaseCount: 0, taskCount: 0 };
  }

  if (!parsed?.phases || !Array.isArray(parsed.phases)) {
    return { phaseCount: 0, taskCount: 0 };
  }

  await storage.deletePlaybookByDeal(dealId);

  let totalTasks = 0;
  for (let i = 0; i < parsed.phases.length; i++) {
    const phaseData = parsed.phases[i];
    const phase = await storage.createPlaybookPhase({
      dealId,
      phaseName: String(phaseData.phase_name || phaseData.phaseName || `Phase ${i + 1}`),
      timeRange: String(phaseData.time_range || phaseData.timeRange || "TBD"),
      status: "pending",
      sortOrder: i,
    });

    const tasks = phaseData.tasks || [];
    for (let j = 0; j < tasks.length; j++) {
      const taskData = tasks[j];
      await storage.createPlaybookTask({
        phaseId: phase.id,
        taskName: String(taskData.task_name || taskData.taskName || `Task ${j + 1}`),
        isCriticalPath: Boolean(taskData.is_critical_path || taskData.isCriticalPath),
        status: "pending",
        sortOrder: j,
      });
      totalTasks++;
    }
  }

  return { phaseCount: parsed.phases.length, taskCount: totalTasks };
}
