/**
 * Microsoft Graph — Security Posture Connector
 *
 * Fetches Secure Score, security controls, and Conditional Access policies.
 */

import type { GraphClient } from "./graph-client.js";
import type {
  SecurityPosture,
  SecurityControl,
  SecurityControlCategory,
  ConditionalAccessPolicy,
} from "../../shared/types.js";

interface GraphSecureScore {
  id: string;
  currentScore: number;
  maxScore: number;
  controlScores: Array<{
    controlName: string;
    controlCategory: string;
    score: number;
    maxScore: number;
    description: string;
    implementationStatus: string;
  }>;
  createdDateTime: string;
}

interface GraphConditionalAccessPolicy {
  id: string;
  displayName: string;
  state: string;
  conditions: Record<string, unknown>;
  grantControls: Record<string, unknown>;
  sessionControls?: Record<string, unknown>;
  createdDateTime?: string;
  modifiedDateTime?: string;
}

const CATEGORY_MAP: Record<string, SecurityControlCategory> = {
  Identity: "Identity",
  Data: "Data",
  Device: "Device",
  Apps: "App",
  Infrastructure: "Infrastructure",
};

export async function fetchSecurityPosture(
  client: GraphClient,
  tenantId: string,
): Promise<SecurityPosture> {
  const scores = await client.get<{ value: GraphSecureScore[] }>(
    "/security/secureScores",
    { $top: "1", $orderby: "createdDateTime desc" },
  );

  const latest = scores.value?.[0];

  if (!latest) {
    return {
      tenantId,
      sourceVendor: "microsoft",
      nativeScore: 0,
      maxPossibleScore: 0,
      scorePct: 0,
      controls: [],
      capturedAt: new Date(),
    };
  }

  const controls: SecurityControl[] = (latest.controlScores || []).map((cs) => ({
    controlId: cs.controlName,
    controlName: cs.controlName.replace(/([A-Z])/g, " $1").trim(),
    category: CATEGORY_MAP[cs.controlCategory] || "Identity",
    nativeStatus: mapImplementationStatus(cs.implementationStatus),
    pointsAchieved: cs.score,
    maxPoints: cs.maxScore,
    vendorRecommendation: cs.description,
  }));

  return {
    tenantId,
    sourceVendor: "microsoft",
    nativeScore: latest.currentScore,
    maxPossibleScore: latest.maxScore,
    scorePct: latest.maxScore > 0
      ? Math.round((latest.currentScore / latest.maxScore) * 100)
      : 0,
    controls,
    capturedAt: new Date(latest.createdDateTime),
  };
}

export async function fetchConditionalAccessPolicies(
  client: GraphClient,
  tenantId: string,
): Promise<ConditionalAccessPolicy[]> {
  try {
    const policies = await client.getAll<GraphConditionalAccessPolicy>(
      "/identity/conditionalAccess/policies",
    );

    return policies.map((p): ConditionalAccessPolicy => ({
      id: p.id,
      tenantId,
      displayName: p.displayName,
      state: p.state as ConditionalAccessPolicy["state"],
      conditions: p.conditions,
      grantControls: p.grantControls,
      sessionControls: p.sessionControls,
      createdAt: p.createdDateTime ? new Date(p.createdDateTime) : undefined,
      modifiedAt: p.modifiedDateTime ? new Date(p.modifiedDateTime) : undefined,
    }));
  } catch {
    return [];
  }
}

function mapImplementationStatus(
  status: string,
): SecurityControl["nativeStatus"] {
  switch (status?.toLowerCase()) {
    case "implemented":
    case "thirdparty":
      return "implemented";
    case "alternativemitigation":
    case "partial":
      return "partial";
    case "notimplemented":
    case "notplanned":
      return "not_implemented";
    case "notapplicable":
      return "not_applicable";
    default:
      return "not_implemented";
  }
}
