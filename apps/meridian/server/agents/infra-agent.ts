/**
 * Meridian Infrastructure Agent Adapters
 *
 * Configures DataExtractorAgent and ComplianceCheckerAgent
 * for Meridian's infrastructure extraction operations.
 */

import { DataExtractorAgent, ComplianceCheckerAgent } from "@cavaridge/agents";
import type { DataExtractorOutput, ComplianceCheckOutput } from "@cavaridge/agents";
import { createMeridianContext } from "./context";

const dataExtractor = new DataExtractorAgent({ appCode: "CVG-MER" });
const complianceChecker = new ComplianceCheckerAgent({ appCode: "CVG-MER" });

// ── Tech Stack Extraction ────────────────────────────────────────────

const TECH_STACK_CATEGORIES = [
  "Identity & Access", "Networking", "Security", "Backup & DR",
  "Productivity", "EHR / Clinical", "Line of Business Apps",
  "Cloud Services", "Endpoints", "Telephony", "Monitoring", "Other",
];

const TECH_STACK_SYSTEM_PROMPT = `You are analyzing IT due diligence documents for a mergers & acquisitions assessment. Extract every technology, product, platform, and service mentioned.

For each technology detected, provide:
- category: one of [${TECH_STACK_CATEGORIES.join(", ")}]
- item_name: the product/technology name
- version: version number if mentioned (null if not)
- status: "current", "eol" (end of life), "deprecated", or "unknown"
- notes: brief context (how it's used, any concerns mentioned)
- confidence: "high", "medium", or "low"

Respond as a JSON array. Deduplicate — if the same technology appears in multiple documents, combine the information. Flag version conflicts.

IMPORTANT: Respond with ONLY a valid JSON array, no other text.`;

export async function extractTechStackViaAgent(
  text: string,
  tenantId: string = "system",
): Promise<DataExtractorOutput> {
  const context = createMeridianContext(tenantId, "system", {
    agentId: "data-extractor",
    agentName: "Tech Stack Extractor",
  });

  const output = await dataExtractor.runWithAudit({
    data: {
      text,
      extractionType: "tech_stack",
      systemPrompt: TECH_STACK_SYSTEM_PROMPT,
      maxTokens: 4096,
    },
    context,
  });

  return output.result;
}

// ── Topology Extraction ──────────────────────────────────────────────

const TOPOLOGY_SYSTEM_PROMPT = `You are an IT infrastructure analyst. Extract the network topology from the provided documents.

Identify:
1. Nodes: facilities, servers, cloud services, network devices, workstations
2. Connections: WAN, LAN, VPN, internet, trunk, fiber, wireless links between nodes

Respond as JSON:
{
  "nodes": [{ "name": "...", "type": "facility|server|cloud|network_device|workstation|other", "details": "..." }],
  "connections": [{ "source": "node_name", "target": "node_name", "type": "WAN|LAN|VPN|internet|trunk|fiber|wireless", "details": "..." }]
}

IMPORTANT: Respond with ONLY valid JSON, no other text.`;

export async function extractTopologyViaAgent(
  text: string,
  tenantId: string = "system",
): Promise<DataExtractorOutput> {
  const context = createMeridianContext(tenantId, "system", {
    agentId: "data-extractor",
    agentName: "Topology Extractor",
  });

  const output = await dataExtractor.runWithAudit({
    data: {
      text,
      extractionType: "topology",
      systemPrompt: TOPOLOGY_SYSTEM_PROMPT,
      maxTokens: 4096,
    },
    context,
  });

  return output.result;
}

// ── Baseline Comparison ──────────────────────────────────────────────

export async function compareBaselineViaAgent(
  systemPrompt: string,
  userPrompt: string,
  tenantId: string = "system",
): Promise<ComplianceCheckOutput> {
  const context = createMeridianContext(tenantId, "system", {
    agentId: "compliance-checker",
    agentName: "Baseline Comparator",
  });

  const output = await complianceChecker.runWithAudit({
    data: {
      standardName: "Organization Baseline",
      currentState: [],
      systemPrompt,
      userPrompt,
    },
    context,
  });

  return output.result;
}

// ── Playbook Generation ──────────────────────────────────────────────

const PLAYBOOK_SYSTEM_PROMPT = `You are an M&A IT integration specialist. Generate a phased integration playbook.

Create phases: Pre-Close, Day-1, Infrastructure Migration, Application Integration, Security Hardening, Steady State.

For each phase provide tasks with:
- title
- description
- estimated_days
- priority: "critical" | "high" | "medium" | "low"
- dependencies (task titles this depends on)

Respond as JSON:
{
  "phases": [{
    "name": "...",
    "description": "...",
    "order": 1,
    "tasks": [{ "title": "...", "description": "...", "estimated_days": 5, "priority": "high", "dependencies": [] }]
  }]
}

IMPORTANT: Respond with ONLY valid JSON.`;

export async function generatePlaybookViaAgent(
  text: string,
  tenantId: string = "system",
): Promise<DataExtractorOutput> {
  const context = createMeridianContext(tenantId, "system", {
    agentId: "data-extractor",
    agentName: "Playbook Generator",
  });

  const output = await dataExtractor.runWithAudit({
    data: {
      text,
      extractionType: "playbook",
      systemPrompt: PLAYBOOK_SYSTEM_PROMPT,
      maxTokens: 4096,
    },
    context,
  });

  return output.result;
}
