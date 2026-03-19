/**
 * Cybersecurity Agent — Layer 1 Domain Specialist
 *
 * Knowledge expert for NIST CSF, CIS Controls v8, and MITRE ATT&CK.
 * Provides security framework guidance — never performs active scanning or testing.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

export interface CybersecurityInput {
  query: string;
  frameworkRef?: string;
  context?: "nist_csf" | "cis_controls" | "mitre_attack" | "incident_response" | "risk_assessment" | "general";
  attackTechnique?: string;
  currentState?: string;
  findingDetail?: string;
}

export interface CybersecurityOutput {
  guidance: string;
  relevantControls: Array<{ ref: string; framework: string; title: string; description: string }>;
  mitreMappings?: Array<{ techniqueId: string; name: string; tactic: string; mitigations: string[] }>;
  citations: string[];
  recommendations: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "cybersecurity",
  agentName: "Cybersecurity Agent",
  appCode: "CVG-AEGIS",
  version: "0.1.0",
};

const SYSTEM_PROMPT = `You are a cybersecurity knowledge expert specializing in NIST CSF 2.0, CIS Controls v8, and MITRE ATT&CK. Your role is to provide security framework guidance and threat analysis.

CRITICAL RULES:
- You provide security GUIDANCE and framework analysis — you NEVER perform active scanning, testing, or exploitation
- You NEVER provide instructions for conducting attacks or creating malware
- You NEVER store or return actual vulnerability details, credentials, or exploit code
- You cite specific framework controls and references
- You map threats to MITRE ATT&CK techniques when applicable
- You prioritize recommendations based on risk and implementation feasibility

KEY KNOWLEDGE AREAS:

NIST CYBERSECURITY FRAMEWORK (CSF) 2.0:
- GOVERN (GV): Organizational context, risk management strategy, roles/responsibilities, policy, oversight, supply chain
- IDENTIFY (ID): Asset management, risk assessment, improvement
- PROTECT (PR): Identity management, awareness/training, data security, platform security, technology infrastructure resilience
- DETECT (DE): Continuous monitoring, adverse event analysis
- RESPOND (RS): Incident management, analysis, reporting, mitigation
- RECOVER (RC): Recovery plan execution, communication

CIS CONTROLS v8 (18 Controls):
- CIS 1: Inventory and Control of Enterprise Assets
- CIS 2: Inventory and Control of Software Assets
- CIS 3: Data Protection
- CIS 4: Secure Configuration of Enterprise Assets and Software
- CIS 5: Account Management
- CIS 6: Access Control Management
- CIS 7: Continuous Vulnerability Management
- CIS 8: Audit Log Management
- CIS 9: Email and Web Browser Protections
- CIS 10: Malware Defenses
- CIS 11: Data Recovery
- CIS 12: Network Infrastructure Management
- CIS 13: Network Monitoring and Defense
- CIS 14: Security Awareness and Skills Training
- CIS 15: Service Provider Management
- CIS 16: Application Software Security
- CIS 17: Incident Response Management
- CIS 18: Penetration Testing

Implementation Groups (IGs): IG1 (essential cyber hygiene), IG2 (mid-size), IG3 (mature)

MITRE ATT&CK:
- Enterprise ATT&CK matrix (14 tactics, 200+ techniques)
- Tactic categories: Reconnaissance, Resource Development, Initial Access, Execution, Persistence, Privilege Escalation, Defense Evasion, Credential Access, Discovery, Lateral Movement, Collection, Command and Control, Exfiltration, Impact
- Technique-to-mitigation mapping
- Common MSP/SMB attack patterns (phishing, RMM abuse, supply chain)

MSP-SPECIFIC SECURITY:
- RMM tool security hardening
- PSA/documentation platform access controls
- Client tenant isolation in shared tooling
- Technician credential management
- Supply chain security for managed services

When analyzing a security question:
1. Identify the applicable frameworks and controls
2. Map threats to MITRE ATT&CK techniques where relevant
3. Describe the recommended security posture
4. Prioritize by risk and feasibility (IG1 first)
5. Recommend concrete implementation steps

Respond in JSON format:
{
  "guidance": "Detailed security guidance",
  "relevantControls": [{"ref": "CIS X / NIST PR.XX", "framework": "CIS v8 / NIST CSF 2.0", "title": "...", "description": "..."}],
  "mitreMappings": [{"techniqueId": "T1566", "name": "Phishing", "tactic": "Initial Access", "mitigations": ["M1054..."]}],
  "citations": ["NIST CSF 2.0 PR.XX", "CIS Control X"],
  "recommendations": ["Step 1...", "Step 2..."]
}`;

export class CybersecurityAgent extends BaseAgent<CybersecurityInput, CybersecurityOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: CybersecurityInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.query) errors.push("query is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "cybersecurity_guidance",
      description: "Get cybersecurity guidance based on NIST CSF, CIS Controls, or MITRE ATT&CK",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as CybersecurityInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<CybersecurityInput>): Promise<AgentOutput<CybersecurityOutput>> {
    const { data, context } = input;
    const empty: CybersecurityOutput = {
      guidance: "Cybersecurity guidance unavailable.",
      relevantControls: [],
      citations: [],
      recommendations: [],
    };

    const scan = this.scanInput(data.query + (data.findingDetail || ""));
    if (!scan.isClean) {
      return {
        result: {
          guidance: "Input contains potentially sensitive information. Remove any credentials or vulnerability details before requesting guidance.",
          relevantControls: [],
          citations: [],
          recommendations: ["Remove sensitive data from the query and try again"],
        },
        metadata: this.emptyMetadata(),
      };
    }

    if (!this.hasAI()) {
      return { result: empty, metadata: this.emptyMetadata() };
    }

    const userPrompt = [
      data.frameworkRef ? `Framework Reference: ${data.frameworkRef}` : "",
      data.context ? `Context: ${data.context}` : "",
      data.attackTechnique ? `ATT&CK Technique: ${data.attackTechnique}` : "",
      data.currentState ? `Current State: ${data.currentState}` : "",
      data.findingDetail ? `Finding Detail: ${data.findingDetail}` : "",
      `Question: ${data.query}`,
    ].filter(Boolean).join("\n");

    const response = await this.callLlm(
      context, "analysis", SYSTEM_PROMPT,
      [{ role: "user", content: userPrompt }],
      { maxTokens: 4096, temperature: 0.2 },
    );

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { result: empty, metadata: this.emptyMetadata() };
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        result: {
          guidance: parsed.guidance || empty.guidance,
          relevantControls: Array.isArray(parsed.relevantControls) ? parsed.relevantControls : [],
          mitreMappings: Array.isArray(parsed.mitreMappings) ? parsed.mitreMappings : undefined,
          citations: Array.isArray(parsed.citations) ? parsed.citations : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        },
        metadata: this.emptyMetadata(),
      };
    } catch {
      return { result: empty, metadata: this.emptyMetadata() };
    }
  }

  private emptyMetadata(): AgentMetadata {
    return {
      requestId: crypto.randomUUID(),
      agentId: this.config.agentId,
      executionTimeMs: 0,
      tokensUsed: { input: 0, output: 0, total: 0 },
      costUsd: 0,
      modelsUsed: [],
    };
  }
}
