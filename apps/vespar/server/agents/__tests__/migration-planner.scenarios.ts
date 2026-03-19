/**
 * Migration Planner Agent Test Scenarios
 *
 * These scenario definitions are designed for the @cavaridge/agent-test
 * simulation engine. Each scenario defines workloads, dependencies, and
 * expected outcomes for the Migration Planner agent pipeline.
 */

import type { InsertWorkload, InsertDependency } from "@shared/schema";

interface TestScenario {
  id: string;
  name: string;
  description: string;
  sourceEnvironment: string;
  targetEnvironment: string;
  workloads: Omit<InsertWorkload, "projectId" | "tenantId">[];
  dependencies: { sourceIndex: number; targetIndex: number; type: string; blocksMigration: boolean }[];
  expectations: {
    minRiskFindings: number;
    expectedSeverities: string[];
    expectedCategories: string[];
    sequencePhaseCount: number;
    costProjectionGenerated: boolean;
    runbookSections: string[];
  };
}

export const scenarios: TestScenario[] = [
  // -----------------------------------------------------------------------
  // Scenario 1: On-Prem Windows Server Farm → Azure
  // -----------------------------------------------------------------------
  {
    id: "onprem-to-azure-ad",
    name: "On-Prem Windows Server Farm to Azure with AD",
    description: "10 Windows Servers with Active Directory dependency, SQL Server databases, file shares. Tests dependency detection, risk scoring for AD as blocking dependency, cost comparison.",
    sourceEnvironment: "on-prem",
    targetEnvironment: "azure",
    workloads: [
      { name: "Domain Controller (Primary)", type: "identity", criticality: "critical", migrationStrategy: "replatform", currentHosting: "Dell PowerEdge R740", environmentDetails: { os: "Windows Server 2019", role: "AD DS, DNS, DHCP", users: 450 } },
      { name: "Domain Controller (Secondary)", type: "identity", criticality: "critical", migrationStrategy: "replatform", currentHosting: "Dell PowerEdge R740", environmentDetails: { os: "Windows Server 2019", role: "AD DS replica" } },
      { name: "SQL Server (ERP)", type: "database", criticality: "critical", migrationStrategy: "replatform", currentHosting: "Dell PowerEdge R740", environmentDetails: { engine: "SQL Server 2019 Enterprise", sizeGb: 500, connections: 120 } },
      { name: "SQL Server (CRM)", type: "database", criticality: "high", migrationStrategy: "replatform", currentHosting: "Dell PowerEdge R640", environmentDetails: { engine: "SQL Server 2019 Standard", sizeGb: 200, connections: 50 } },
      { name: "ERP Application Server", type: "application", criticality: "critical", migrationStrategy: "rehost", currentHosting: "Dell PowerEdge R740", environmentDetails: { os: "Windows Server 2019", app: "Dynamics GP" } },
      { name: "CRM Web Server", type: "application", criticality: "high", migrationStrategy: "rehost", currentHosting: "Dell PowerEdge R640", environmentDetails: { os: "Windows Server 2019", app: "Custom CRM" } },
      { name: "File Server", type: "storage", criticality: "medium", migrationStrategy: "replatform", currentHosting: "Synology NAS", environmentDetails: { sizeGb: 2000, shares: 15 } },
      { name: "Print Server", type: "server", criticality: "low", migrationStrategy: "retire", currentHosting: "HP ProLiant DL360", environmentDetails: { printers: 12 } },
      { name: "Backup Server", type: "server", criticality: "high", migrationStrategy: "repurchase", currentHosting: "Dell PowerEdge R640", environmentDetails: { app: "Veeam B&R", backupSizeTb: 8 } },
      { name: "RDS Gateway", type: "server", criticality: "medium", migrationStrategy: "rehost", currentHosting: "Dell PowerEdge R640", environmentDetails: { os: "Windows Server 2019", sessions: 30 } },
    ],
    dependencies: [
      { sourceIndex: 4, targetIndex: 0, type: "hard", blocksMigration: true },  // ERP → DC
      { sourceIndex: 4, targetIndex: 2, type: "hard", blocksMigration: true },  // ERP → SQL ERP
      { sourceIndex: 5, targetIndex: 0, type: "hard", blocksMigration: true },  // CRM → DC
      { sourceIndex: 5, targetIndex: 3, type: "hard", blocksMigration: true },  // CRM → SQL CRM
      { sourceIndex: 6, targetIndex: 0, type: "soft", blocksMigration: false }, // File Server → DC (auth)
      { sourceIndex: 9, targetIndex: 0, type: "hard", blocksMigration: true },  // RDS → DC
      { sourceIndex: 8, targetIndex: 2, type: "data", blocksMigration: false }, // Backup → SQL ERP
      { sourceIndex: 8, targetIndex: 3, type: "data", blocksMigration: false }, // Backup → SQL CRM
    ],
    expectations: {
      minRiskFindings: 8,
      expectedSeverities: ["critical", "high", "medium"],
      expectedCategories: ["technical", "operational", "financial"],
      sequencePhaseCount: 4, // DC first, then DBs, then apps, then support services
      costProjectionGenerated: true,
      runbookSections: ["Pre-Migration", "AD Migration", "Database Migration", "Application Migration", "Validation"],
    },
  },

  // -----------------------------------------------------------------------
  // Scenario 2: AWS → GCP Multi-Region
  // -----------------------------------------------------------------------
  {
    id: "aws-to-gcp-multiregion",
    name: "AWS to GCP Multi-Region Migration",
    description: "Multi-region AWS setup with RDS, S3, ECS services migrating to GCP equivalents. Tests service mapping, data transfer costs, cross-cloud network risks.",
    sourceEnvironment: "aws",
    targetEnvironment: "gcp",
    workloads: [
      { name: "API Gateway (us-east-1)", type: "application", criticality: "critical", migrationStrategy: "replatform", currentHosting: "AWS API Gateway", environmentDetails: { service: "API Gateway", region: "us-east-1", requestsPerDay: 5000000 } },
      { name: "ECS Cluster (API)", type: "application", criticality: "critical", migrationStrategy: "replatform", currentHosting: "AWS ECS Fargate", environmentDetails: { service: "ECS", tasks: 12, cpu: "2 vCPU", memory: "4GB" } },
      { name: "RDS PostgreSQL (Primary)", type: "database", criticality: "critical", migrationStrategy: "replatform", currentHosting: "AWS RDS", environmentDetails: { engine: "PostgreSQL 15", instanceClass: "db.r6g.xlarge", sizeGb: 800, multiAz: true } },
      { name: "RDS PostgreSQL (Replica us-west-2)", type: "database", criticality: "high", migrationStrategy: "replatform", currentHosting: "AWS RDS", environmentDetails: { engine: "PostgreSQL 15", instanceClass: "db.r6g.large", readReplica: true } },
      { name: "S3 Data Lake", type: "storage", criticality: "high", migrationStrategy: "replatform", currentHosting: "AWS S3", environmentDetails: { buckets: 8, sizeTb: 15, lifecycle: "IA after 30 days" } },
      { name: "ElastiCache Redis", type: "database", criticality: "medium", migrationStrategy: "replatform", currentHosting: "AWS ElastiCache", environmentDetails: { engine: "Redis 7", nodeType: "cache.r6g.large", nodes: 3 } },
      { name: "CloudFront CDN", type: "network", criticality: "medium", migrationStrategy: "repurchase", currentHosting: "AWS CloudFront", environmentDetails: { distributions: 3, origins: 5 } },
      { name: "Lambda Functions", type: "application", criticality: "medium", migrationStrategy: "refactor", currentHosting: "AWS Lambda", environmentDetails: { functions: 45, runtime: "Node.js 20", invocationsPerDay: 2000000 } },
    ],
    dependencies: [
      { sourceIndex: 0, targetIndex: 1, type: "hard", blocksMigration: true },  // API GW → ECS
      { sourceIndex: 1, targetIndex: 2, type: "hard", blocksMigration: true },  // ECS → RDS Primary
      { sourceIndex: 1, targetIndex: 5, type: "soft", blocksMigration: false }, // ECS → Redis
      { sourceIndex: 3, targetIndex: 2, type: "data", blocksMigration: false }, // Replica → Primary
      { sourceIndex: 7, targetIndex: 2, type: "data", blocksMigration: false }, // Lambda → RDS
      { sourceIndex: 7, targetIndex: 4, type: "data", blocksMigration: false }, // Lambda → S3
    ],
    expectations: {
      minRiskFindings: 6,
      expectedSeverities: ["critical", "high", "medium"],
      expectedCategories: ["technical", "financial", "operational"],
      sequencePhaseCount: 3,
      costProjectionGenerated: true,
      runbookSections: ["Database Migration", "Compute Migration", "Storage Migration", "DNS Cutover"],
    },
  },

  // -----------------------------------------------------------------------
  // Scenario 3: Legacy Mainframe
  // -----------------------------------------------------------------------
  {
    id: "legacy-mainframe",
    name: "Legacy Mainframe Application Migration",
    description: "COBOL mainframe application with no direct cloud equivalent. Tests refactor/repurchase strategy recommendation, high risk scoring, extended timeline.",
    sourceEnvironment: "on-prem",
    targetEnvironment: "azure",
    workloads: [
      { name: "IBM z15 Mainframe", type: "server", criticality: "critical", migrationStrategy: "refactor", currentHosting: "IBM z15", environmentDetails: { os: "z/OS 2.5", mips: 3000, partitions: 4, age: "15 years" } },
      { name: "COBOL Application Suite", type: "application", criticality: "critical", migrationStrategy: "refactor", currentHosting: "IBM z15", environmentDetails: { language: "COBOL", linesOfCode: 2000000, modules: 340, noModernEquivalent: true } },
      { name: "DB2 Database", type: "database", criticality: "critical", migrationStrategy: "replatform", currentHosting: "IBM z15", environmentDetails: { engine: "DB2 for z/OS", sizeGb: 1200, tables: 850, storedProcedures: 420 } },
      { name: "CICS Transaction Server", type: "application", criticality: "critical", migrationStrategy: "refactor", currentHosting: "IBM z15", environmentDetails: { transactionsPerDay: 500000, regions: 6 } },
      { name: "JCL Batch Processing", type: "application", criticality: "high", migrationStrategy: "refactor", currentHosting: "IBM z15", environmentDetails: { jobs: 200, scheduledDaily: 85 } },
    ],
    dependencies: [
      { sourceIndex: 1, targetIndex: 0, type: "hard", blocksMigration: true },  // COBOL → Mainframe
      { sourceIndex: 1, targetIndex: 2, type: "hard", blocksMigration: true },  // COBOL → DB2
      { sourceIndex: 3, targetIndex: 1, type: "hard", blocksMigration: true },  // CICS → COBOL
      { sourceIndex: 4, targetIndex: 2, type: "hard", blocksMigration: true },  // JCL → DB2
      { sourceIndex: 4, targetIndex: 1, type: "hard", blocksMigration: true },  // JCL → COBOL
    ],
    expectations: {
      minRiskFindings: 10,
      expectedSeverities: ["critical", "high"],
      expectedCategories: ["technical", "operational", "financial", "organizational"],
      sequencePhaseCount: 3,
      costProjectionGenerated: true,
      runbookSections: ["Assessment", "Application Rewrite", "Data Migration", "Parallel Testing"],
    },
  },

  // -----------------------------------------------------------------------
  // Scenario 4: HIPAA Healthcare Workload
  // -----------------------------------------------------------------------
  {
    id: "hipaa-healthcare",
    name: "HIPAA Healthcare Workload Migration",
    description: "Healthcare workload with PHI data. Tests HIPAA compliance risk generation, BAA requirements, encryption requirements.",
    sourceEnvironment: "on-prem",
    targetEnvironment: "aws",
    workloads: [
      { name: "EHR Application Server", type: "application", criticality: "critical", migrationStrategy: "rehost", currentHosting: "VMware ESXi", environmentDetails: { app: "Custom EHR", containsPhi: true, users: 200, hipaaRequired: true } },
      { name: "EHR Database", type: "database", criticality: "critical", migrationStrategy: "replatform", currentHosting: "VMware ESXi", environmentDetails: { engine: "PostgreSQL 14", sizeGb: 350, containsPhi: true, encryption: "AES-256-at-rest" } },
      { name: "Medical Imaging (PACS)", type: "storage", criticality: "high", migrationStrategy: "replatform", currentHosting: "NetApp FAS", environmentDetails: { sizeTb: 25, format: "DICOM", containsPhi: true, retention: "7 years" } },
      { name: "HL7/FHIR Integration Engine", type: "application", criticality: "critical", migrationStrategy: "rehost", currentHosting: "VMware ESXi", environmentDetails: { protocol: "HL7 v2.5, FHIR R4", interfaces: 15, messagesPerDay: 50000 } },
      { name: "Patient Portal", type: "application", criticality: "high", migrationStrategy: "rehost", currentHosting: "VMware ESXi", environmentDetails: { framework: "React/Node.js", users: 5000, containsPhi: true } },
      { name: "Backup & DR System", type: "server", criticality: "critical", migrationStrategy: "repurchase", currentHosting: "Veeam + tape", environmentDetails: { backupSizeTb: 30, rpo: "1 hour", rto: "4 hours" } },
    ],
    dependencies: [
      { sourceIndex: 0, targetIndex: 1, type: "hard", blocksMigration: true },  // EHR App → EHR DB
      { sourceIndex: 3, targetIndex: 0, type: "hard", blocksMigration: true },  // HL7 → EHR App
      { sourceIndex: 4, targetIndex: 0, type: "hard", blocksMigration: true },  // Portal → EHR App
      { sourceIndex: 0, targetIndex: 2, type: "data", blocksMigration: false }, // EHR → PACS
      { sourceIndex: 5, targetIndex: 1, type: "data", blocksMigration: false }, // Backup → EHR DB
    ],
    expectations: {
      minRiskFindings: 8,
      expectedSeverities: ["critical", "high", "medium"],
      expectedCategories: ["compliance", "technical", "operational"],
      sequencePhaseCount: 3,
      costProjectionGenerated: true,
      runbookSections: ["HIPAA Compliance Checklist", "BAA Verification", "PHI Encryption", "Data Migration", "Validation"],
    },
  },

  // -----------------------------------------------------------------------
  // Scenario 5: Cost Optimization — Oversized VMs
  // -----------------------------------------------------------------------
  {
    id: "cost-optimization-oversized",
    name: "Cost Optimization - Oversized VMs",
    description: "Oversized VMs (16 vCPU/64GB for workloads using 2 vCPU/4GB). Tests right-sizing recommendations, cost savings, replatform strategy.",
    sourceEnvironment: "azure",
    targetEnvironment: "azure",
    workloads: [
      { name: "Dev Web Server", type: "server", criticality: "low", migrationStrategy: "replatform", currentHosting: "Azure D16s_v3", environmentDetails: { allocatedCpu: 16, allocatedMemGb: 64, avgCpuPct: 5, avgMemPct: 6, recommendedSize: "B2s" } },
      { name: "Staging API Server", type: "server", criticality: "medium", migrationStrategy: "replatform", currentHosting: "Azure E8s_v3", environmentDetails: { allocatedCpu: 8, allocatedMemGb: 64, avgCpuPct: 12, avgMemPct: 8, recommendedSize: "D2s_v3" } },
      { name: "Internal Wiki", type: "application", criticality: "low", migrationStrategy: "replatform", currentHosting: "Azure D8s_v3", environmentDetails: { allocatedCpu: 8, allocatedMemGb: 32, avgCpuPct: 3, avgMemPct: 10, recommendedSize: "B2s" } },
      { name: "CI/CD Build Agent", type: "server", criticality: "medium", migrationStrategy: "replatform", currentHosting: "Azure F16s_v2", environmentDetails: { allocatedCpu: 16, allocatedMemGb: 32, avgCpuPct: 45, avgMemPct: 35, peakCpuPct: 95, recommendedSize: "F8s_v2" } },
      { name: "Monitoring Stack", type: "application", criticality: "medium", migrationStrategy: "replatform", currentHosting: "Azure E4s_v3", environmentDetails: { allocatedCpu: 4, allocatedMemGb: 32, avgCpuPct: 15, avgMemPct: 45, recommendedSize: "D2s_v3" } },
    ],
    dependencies: [
      { sourceIndex: 3, targetIndex: 0, type: "soft", blocksMigration: false }, // CI/CD → Dev Web
      { sourceIndex: 4, targetIndex: 1, type: "network", blocksMigration: false }, // Monitoring → Staging API
    ],
    expectations: {
      minRiskFindings: 3,
      expectedSeverities: ["low", "medium"],
      expectedCategories: ["financial", "operational"],
      sequencePhaseCount: 2,
      costProjectionGenerated: true,
      runbookSections: ["Right-Sizing Plan", "Resize Procedure", "Performance Validation"],
    },
  },
];

export default scenarios;
