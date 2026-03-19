/**
 * Tech/Infrastructure Agent — Layer 1 Domain Specialist
 *
 * Knowledge expert for networking, cloud architecture, and infrastructure best practices.
 * Provides technical guidance — never executes changes or accesses live systems.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

export interface TechInput {
  query: string;
  domain?: "networking" | "cloud" | "virtualization" | "storage" | "compute" | "identity" | "monitoring" | "general";
  platform?: string;
  currentState?: string;
  findingDetail?: string;
}

export interface TechOutput {
  guidance: string;
  relevantStandards: Array<{ ref: string; title: string; bestPractice: string }>;
  architectureConsiderations: string[];
  recommendations: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "tech-infrastructure",
  agentName: "Tech/Infrastructure Agent",
  appCode: "CVG-CORE",
  version: "0.1.0",
};

const SYSTEM_PROMPT = `You are a technology and infrastructure knowledge expert. Your role is to provide best-practice guidance on networking, cloud architecture, virtualization, and IT infrastructure.

CRITICAL RULES:
- You provide technical guidance and best practices — you NEVER execute changes on live systems
- You NEVER store or return actual credentials, IP addresses, or sensitive configuration data
- You reference vendor documentation, RFCs, and industry best practices
- You distinguish between on-premises, hybrid, and cloud-native architectures
- You consider MSP/multi-tenant environments in all recommendations

KEY KNOWLEDGE AREAS:

NETWORKING:
- TCP/IP, DNS, DHCP, VLANs, subnetting
- Firewall design (stateful, NGFW, micro-segmentation)
- SD-WAN architecture and deployment patterns
- Zero Trust Network Access (ZTNA) principles
- Wi-Fi design (802.11ax/Wi-Fi 6/6E, controller vs. cloud-managed)
- Network monitoring (SNMP, NetFlow, syslog aggregation)

CLOUD PLATFORMS:
- Microsoft Azure (IaaS, PaaS, M365 integration)
- AWS (EC2, S3, Lambda, VPC, IAM)
- Google Cloud Platform (GCE, GKE, BigQuery)
- Multi-cloud and hybrid strategies
- Cloud cost optimization patterns
- Cloud migration methodologies (6 Rs: Rehost, Replatform, Refactor, Repurchase, Retire, Retain)

VIRTUALIZATION:
- VMware vSphere/ESXi (licensing changes post-Broadcom)
- Microsoft Hyper-V
- Proxmox VE (open-source alternative)
- Container orchestration (Docker, Kubernetes)
- Desktop virtualization (AVD, Citrix, VMware Horizon)

IDENTITY & ACCESS:
- Microsoft Entra ID (Azure AD) / Active Directory
- SSO, MFA, Conditional Access policies
- SCIM provisioning and identity lifecycle
- Privileged Access Management (PAM)

STORAGE & BACKUP:
- SAN/NAS architecture
- Backup strategies (3-2-1 rule, immutable backups)
- Disaster recovery (RPO/RTO planning)
- Object storage vs. block storage vs. file storage

MONITORING & OBSERVABILITY:
- RMM platforms (NinjaOne, Datto, ConnectWise)
- SIEM integration patterns
- APM and infrastructure monitoring
- Alert fatigue management and escalation design

When analyzing a technical question:
1. Identify the domain and applicable best practices
2. Explain the recommended architecture or approach
3. Consider scalability, security, and cost implications
4. Identify common pitfalls
5. Recommend implementation steps

Respond in JSON format:
{
  "guidance": "Detailed technical guidance",
  "relevantStandards": [{"ref": "RFC XXXX / Vendor Doc", "title": "...", "bestPractice": "..."}],
  "architectureConsiderations": ["Consideration 1...", "Consideration 2..."],
  "recommendations": ["Step 1...", "Step 2..."]
}`;

export class TechInfraAgent extends BaseAgent<TechInput, TechOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: TechInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.query) errors.push("query is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "tech_infra_guidance",
      description: "Get technical infrastructure guidance on networking, cloud, virtualization, or IT best practices",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as TechInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<TechInput>): Promise<AgentOutput<TechOutput>> {
    const { data, context } = input;
    const empty: TechOutput = {
      guidance: "Technical guidance unavailable.",
      relevantStandards: [],
      architectureConsiderations: [],
      recommendations: [],
    };

    const scan = this.scanInput(data.query + (data.findingDetail || ""));
    if (!scan.isClean) {
      return {
        result: {
          guidance: "Input contains potentially sensitive information. Remove any credentials or sensitive configuration data before requesting guidance.",
          relevantStandards: [],
          architectureConsiderations: [],
          recommendations: ["Remove sensitive data from the query and try again"],
        },
        metadata: this.emptyMetadata(),
      };
    }

    if (!this.hasAI()) {
      return { result: empty, metadata: this.emptyMetadata() };
    }

    const userPrompt = [
      data.domain ? `Domain: ${data.domain}` : "",
      data.platform ? `Platform: ${data.platform}` : "",
      data.currentState ? `Current State: ${data.currentState}` : "",
      data.findingDetail ? `Finding Detail: ${data.findingDetail}` : "",
      `Question: ${data.query}`,
    ].filter(Boolean).join("\n");

    const response = await this.callLlm(
      context, "analysis", SYSTEM_PROMPT,
      [{ role: "user", content: userPrompt }],
      { maxTokens: 4096, temperature: 0.3 },
    );

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { result: empty, metadata: this.emptyMetadata() };
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        result: {
          guidance: parsed.guidance || empty.guidance,
          relevantStandards: Array.isArray(parsed.relevantStandards) ? parsed.relevantStandards : [],
          architectureConsiderations: Array.isArray(parsed.architectureConsiderations) ? parsed.architectureConsiderations : [],
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
