/**
 * Document Classifier — delegates to Document Analysis Agent
 *
 * This file re-exports from the agent adapter for backward compatibility.
 * All consumers import from here and get agent-powered classification.
 */

import {
  classifyDocumentAI as agentClassify,
  type ClassificationResult as AgentClassificationResult,
} from "./agents/document-agent";

const ALLOWED_TYPES = [
  "network_diagram", "security_policy", "backup_config", "vendor_contract",
  "org_chart", "asset_inventory", "firewall_rules", "compliance_report",
  "disaster_recovery_plan", "cloud_config", "email_migration", "software_license",
  "sla_agreement", "penetration_test", "vulnerability_scan", "configuration_export",
  "screenshot", "invoice", "proposal", "meeting_notes", "unknown",
] as const;

export type DocumentTypeValue = typeof ALLOWED_TYPES[number];

export interface ClassificationResult {
  documentType: DocumentTypeValue;
  pillars: {
    infrastructure: boolean;
    security: boolean;
    operations: boolean;
    compliance: boolean;
    scalability: boolean;
    strategy: boolean;
  };
  confidence: number;
  reasoning: string;
}

export async function classifyDocumentAI(
  filename: string,
  mimeType: string,
  textContent: string,
): Promise<ClassificationResult> {
  const result = await agentClassify(filename, mimeType, textContent);
  // Cast agent result to Meridian's typed result
  return {
    documentType: (ALLOWED_TYPES.includes(result.documentType as DocumentTypeValue) ? result.documentType : "unknown") as DocumentTypeValue,
    pillars: {
      infrastructure: !!result.pillars.infrastructure,
      security: !!result.pillars.security,
      operations: !!result.pillars.operations,
      compliance: !!result.pillars.compliance,
      scalability: !!result.pillars.scalability,
      strategy: !!result.pillars.strategy,
    },
    confidence: result.confidence,
    reasoning: result.reasoning,
  };
}
