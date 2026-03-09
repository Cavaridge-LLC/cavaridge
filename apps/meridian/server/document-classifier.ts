import { chatCompletion, hasAICapability } from "./openrouter";

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

const FALLBACK_RESULT: ClassificationResult = {
  documentType: "unknown",
  pillars: { infrastructure: false, security: false, operations: false, compliance: false, scalability: false, strategy: false },
  confidence: 0,
  reasoning: "Classification unavailable",
};

export async function classifyDocumentAI(
  filename: string,
  mimeType: string,
  textContent: string,
): Promise<ClassificationResult> {
  if (!hasAICapability()) {
    console.log("[document-classifier] No OPENROUTER_API_KEY, skipping AI classification");
    return FALLBACK_RESULT;
  }

  const excerpt = textContent.slice(0, 3000);
  if (!excerpt || excerpt.trim().length < 10) {
    return { ...FALLBACK_RESULT, reasoning: "Insufficient text content for classification" };
  }

  try {
    const responseText = await chatCompletion({
      task: "documentClassification",
      maxTokens: 500,
      system: `You are a document classifier for IT due diligence assessments. Given a document's filename and content excerpt, classify it and map it to assessment pillars.

Respond in JSON only, no markdown, no explanation:
{
  "document_type": "<one of the allowed types>",
  "pillars": {
    "infrastructure": true/false,
    "security": true/false,
    "operations": true/false,
    "compliance": true/false,
    "scalability": true/false,
    "strategy": true/false
  },
  "confidence": 0.0-1.0,
  "reasoning": "<one sentence explaining classification>"
}

Allowed document_type values:
network_diagram, security_policy, backup_config, vendor_contract, org_chart,
asset_inventory, firewall_rules, compliance_report, disaster_recovery_plan,
cloud_config, email_migration, software_license, sla_agreement,
penetration_test, vulnerability_scan, configuration_export,
screenshot, invoice, proposal, meeting_notes, unknown`,
      messages: [
        { role: "user", content: `Classify this document:\n\nFilename: ${filename}\nMIME: ${mimeType}\n\nContent excerpt:\n${excerpt}` },
      ],
    });

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return FALLBACK_RESULT;
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      documentType: ALLOWED_TYPES.includes(parsed.document_type) ? parsed.document_type : "unknown",
      pillars: {
        infrastructure: !!parsed.pillars?.infrastructure,
        security: !!parsed.pillars?.security,
        operations: !!parsed.pillars?.operations,
        compliance: !!parsed.pillars?.compliance,
        scalability: !!parsed.pillars?.scalability,
        strategy: !!parsed.pillars?.strategy,
      },
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning || "Classified by AI",
    };
  } catch (err: any) {
    console.error("[document-classifier] Classification failed:", err.message);
    return FALLBACK_RESULT;
  }
}
