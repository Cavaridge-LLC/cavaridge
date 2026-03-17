/**
 * Meridian Document Analysis Agent Adapter
 *
 * Configures the shared DocumentAnalysisAgent with Meridian's
 * 21 classification types and 6 pillar mappings.
 */

import {
  DocumentAnalysisAgent,
  type ClassificationResult,
  type VisionResult,
} from "@cavaridge/agents";
import { createMeridianContext } from "./context";

// ── Meridian-specific configuration ──────────────────────────────────

const ALLOWED_TYPES = [
  "network_diagram", "security_policy", "backup_config", "vendor_contract",
  "org_chart", "asset_inventory", "firewall_rules", "compliance_report",
  "disaster_recovery_plan", "cloud_config", "email_migration", "software_license",
  "sla_agreement", "penetration_test", "vulnerability_scan", "configuration_export",
  "screenshot", "invoice", "proposal", "meeting_notes", "unknown",
] as const;

const PILLAR_NAMES = [
  "infrastructure", "security", "operations",
  "compliance", "scalability", "strategy",
] as const;

const agent = new DocumentAnalysisAgent(
  {
    allowedTypes: ALLOWED_TYPES,
    pillarNames: PILLAR_NAMES,
  },
  { appCode: "CVG-MER" },
);

// ── Drop-in replacement exports ──────────────────────────────────────

export type DocumentTypeValue = typeof ALLOWED_TYPES[number];

export type { ClassificationResult, VisionResult };

const FALLBACK_RESULT: ClassificationResult = {
  documentType: "unknown",
  pillars: { infrastructure: false, security: false, operations: false, compliance: false, scalability: false, strategy: false },
  confidence: 0,
  reasoning: "Classification unavailable",
};

/**
 * Classify a document using the Document Analysis Agent.
 * Same signature as the original document-classifier.ts function.
 */
export async function classifyDocumentAI(
  filename: string,
  mimeType: string,
  textContent: string,
): Promise<ClassificationResult> {
  if (!agent.hasAI()) {
    return FALLBACK_RESULT;
  }

  const excerpt = textContent.slice(0, 3000);
  if (!excerpt || excerpt.trim().length < 10) {
    return { ...FALLBACK_RESULT, reasoning: "Insufficient text content for classification" };
  }

  try {
    const context = createMeridianContext("system", "system", {
      agentId: "document-analysis",
      agentName: "Document Analysis Agent",
    });

    const output = await agent.runWithAudit({
      data: { content: textContent, filename, mimeType },
      context,
    });

    return output.result.classification ?? FALLBACK_RESULT;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[document-agent] Classification failed:", message);
    return FALLBACK_RESULT;
  }
}

/**
 * Analyze an image using the Document Analysis Agent.
 */
export async function analyzeImageViaAgent(
  imageBase64: string,
  filename: string,
  mediaType: string,
): Promise<VisionResult | null> {
  if (!agent.hasAI()) return null;

  try {
    const context = createMeridianContext("system", "system", {
      agentId: "document-analysis",
      agentName: "Document Analysis Agent",
    });

    const output = await agent.runWithAudit({
      data: {
        content: "",
        filename,
        mimeType: mediaType,
        imageBase64,
        imageMediaType: mediaType,
      },
      context,
    });

    return output.result.vision;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[document-agent] Vision analysis failed:", message);
    return null;
  }
}
