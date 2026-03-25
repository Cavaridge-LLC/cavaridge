/**
 * Vespar Ducky HTTP Client
 *
 * All AI calls route through Ducky (CVG-RESEARCH) HTTP API.
 * Ducky is the sole consumer of Spaniel — Vespar never calls Spaniel directly.
 */

const DUCKY_BASE_URL = process.env.DUCKY_API_URL || "http://localhost:5200";
const DUCKY_SERVICE_TOKEN = process.env.DUCKY_SERVICE_TOKEN || "";

interface DuckyMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface DuckyRequest {
  app_code: string;
  task_type: string;
  messages: DuckyMessage[];
  max_tokens?: number;
  temperature?: number;
}

interface DuckyResponse {
  content: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Send a request to the Ducky Intelligence API.
 * Returns the text content of the response.
 */
export async function callDucky(
  taskType: string,
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; temperature?: number },
): Promise<DuckyResponse> {
  const body: DuckyRequest = {
    app_code: "CVG-VESPAR",
    task_type: taskType,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: options?.maxTokens ?? 2048,
    temperature: options?.temperature ?? 0.3,
  };

  const response = await fetch(`${DUCKY_BASE_URL}/api/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(DUCKY_SERVICE_TOKEN
        ? { Authorization: `Bearer ${DUCKY_SERVICE_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Ducky API error ${response.status}: ${errorText}`,
    );
  }

  return response.json() as Promise<DuckyResponse>;
}

/**
 * Classify a workload using the 6Rs migration strategy via Ducky.
 * Returns the recommended strategy and reasoning.
 */
export async function classifyWorkloadStrategy(workload: {
  name: string;
  type: string;
  criticality: string;
  currentHosting?: string | null;
  environmentDetails?: Record<string, unknown> | null;
  notes?: string | null;
}): Promise<{ strategy: string; reasoning: string; confidence: number }> {
  const systemPrompt = `You are a cloud migration strategist. Classify the given workload into one of the 6Rs migration strategies:
- rehost: Lift-and-shift with no code changes
- replatform: Lift-and-reshape with minor optimizations (e.g., managed DB)
- refactor: Re-architect for cloud-native patterns
- repurchase: Replace with SaaS/commercial equivalent
- retire: Decommission — no longer needed
- retain: Keep on-premises — too risky/complex to move now

Respond with valid JSON only:
{"strategy": "<one of the 6Rs>", "reasoning": "<brief explanation>", "confidence": <0.0 to 1.0>}`;

  const userPrompt = `Classify migration strategy for:
Name: ${workload.name}
Type: ${workload.type}
Criticality: ${workload.criticality}
Current Hosting: ${workload.currentHosting ?? "unknown"}
Environment Details: ${workload.environmentDetails ? JSON.stringify(workload.environmentDetails) : "none"}
Notes: ${workload.notes ?? "none"}`;

  try {
    const response = await callDucky("analysis", systemPrompt, userPrompt, {
      maxTokens: 512,
      temperature: 0.2,
    });

    const parsed = JSON.parse(response.content) as {
      strategy: string;
      reasoning: string;
      confidence: number;
    };
    return parsed;
  } catch {
    // Deterministic fallback when Ducky is unavailable
    return classifyWorkloadDeterministic(workload);
  }
}

/**
 * Deterministic strategy classification fallback.
 */
function classifyWorkloadDeterministic(workload: {
  type: string;
  criticality: string;
  notes?: string | null;
}): { strategy: string; reasoning: string; confidence: number } {
  const notes = (workload.notes ?? "").toLowerCase();

  // Check notes for explicit hints
  if (notes.includes("decommission") || notes.includes("retire") || notes.includes("end of life")) {
    return { strategy: "retire", reasoning: "Notes indicate workload should be decommissioned.", confidence: 0.7 };
  }
  if (notes.includes("saas") || notes.includes("replace") || notes.includes("repurchase")) {
    return { strategy: "repurchase", reasoning: "Notes suggest replacing with a SaaS solution.", confidence: 0.6 };
  }
  if (notes.includes("refactor") || notes.includes("cloud-native") || notes.includes("redesign")) {
    return { strategy: "refactor", reasoning: "Notes suggest re-architecting for cloud-native.", confidence: 0.6 };
  }

  // Type-based defaults
  switch (workload.type) {
    case "database":
      return { strategy: "replatform", reasoning: "Databases benefit from managed services (RDS, Cloud SQL).", confidence: 0.5 };
    case "identity":
      return { strategy: "retain", reasoning: "Identity systems carry high risk and often stay on-prem initially.", confidence: 0.5 };
    case "application":
      if (workload.criticality === "critical" || workload.criticality === "high") {
        return { strategy: "replatform", reasoning: "Critical applications benefit from managed platform services.", confidence: 0.4 };
      }
      return { strategy: "rehost", reasoning: "Standard applications default to lift-and-shift.", confidence: 0.4 };
    case "storage":
      return { strategy: "rehost", reasoning: "Storage workloads are typically rehosted to cloud storage.", confidence: 0.5 };
    case "network":
      return { strategy: "replatform", reasoning: "Network services benefit from cloud-native networking.", confidence: 0.4 };
    default:
      return { strategy: "rehost", reasoning: "Default to lift-and-shift for unclassified workloads.", confidence: 0.3 };
  }
}
