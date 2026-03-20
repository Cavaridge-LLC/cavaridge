/**
 * @cavaridge/blueprints — 10 seed blueprints from the Platform Build Spec.
 *
 * All seeds are platform-level (tenant_id = null).
 * Call seedBlueprints(registry) to insert them.
 */

import type { BlueprintRegistry } from "./registry.js";
import type { BlueprintSearch } from "./search.js";
import type { Blueprint, NewBlueprint } from "./types.js";

export const SEED_BLUEPRINTS: NewBlueprint[] = [
  // ── 1. ASC Network Deployment SoW ─────────────────────────────
  {
    name: "ASC Network Deployment SoW",
    description: "Statement of Work template for ambulatory surgery center network infrastructure deployment, including structured cabling, switching, wireless, and firewall configuration.",
    category: "workflow",
    buildPlan: {
      name: "ASC Network Deployment SoW",
      description: "End-to-end SoW generation for ASC network deployments",
      agentGraph: [
        { agentId: "document-analysis", layer: 2, description: "Ingest site survey and floor plans", inputs: ["site_survey_pdf"], outputs: ["site_analysis"] },
        { agentId: "cost-analyzer", layer: 2, description: "Calculate hardware, licensing, and labor costs", inputs: ["site_analysis", "equipment_list"], outputs: ["cost_breakdown"] },
        { agentId: "sow-generator", layer: 3, description: "Generate formatted SoW document", inputs: ["site_analysis", "cost_breakdown", "template_vars"], outputs: ["sow_document"] },
      ],
      tools: [
        { name: "equipment_lookup", description: "Look up current pricing for network equipment", parameters: { vendor: "string", model: "string" } },
      ],
      schemas: [
        { tableName: "sow_drafts", fields: [{ name: "id", type: "uuid" }, { name: "tenant_id", type: "uuid" }, { name: "title", type: "text" }, { name: "content", type: "jsonb" }, { name: "status", type: "varchar" }], rls: true },
      ],
      uiWireframes: [
        { route: "/sow/new", component: "SoWBuilder", description: "Multi-step SoW creation wizard" },
        { route: "/sow/:id", component: "SoWViewer", description: "Read-only SoW preview with PDF export" },
      ],
      rbacMatrix: [
        { role: "msp_admin", resource: "sow_drafts", actions: ["create", "read", "update", "delete"] },
        { role: "msp_tech", resource: "sow_drafts", actions: ["create", "read", "update"] },
        { role: "client_admin", resource: "sow_drafts", actions: ["read"] },
      ],
      testScenarios: [
        { name: "Generate ASC SoW with valid inputs", category: "functional", input: { siteName: "Tampa ASC", switchCount: 3 }, expectedOutcome: "pass" },
        { name: "Reject SoW generation without tenant context", category: "tenant_isolation", input: {}, expectedOutcome: "fail" },
        { name: "Verify labor hours in valid range", category: "functional", input: { siteName: "Test ASC", switchCount: 1 }, expectedOutcome: "pass" },
      ],
    },
    templateCode: [
      { path: "src/sow/builder.tsx", content: "// SoW Builder component\n// {{APP_NAME}} — {{TENANT_NAME}}\nexport function SoWBuilder() { return null; }", placeholders: ["APP_NAME", "TENANT_NAME"] },
    ],
    variables: [
      { key: "TENANT_NAME", label: "MSP Name", type: "string", required: true, description: "Name of the MSP tenant" },
      { key: "DEFAULT_LABOR_RATE", label: "Standard Labor Rate", type: "number", defaultValue: 185, required: false, description: "Hourly rate for standard labor" },
      { key: "INCLUDE_WIRELESS", label: "Include Wireless", type: "boolean", defaultValue: true, required: false },
    ],
    tags: ["sow", "network", "asc", "healthcare", "infrastructure"],
    version: "1.0.0",
    tenantId: null,
  },

  // ── 2. Citrix-to-RDS Migration SoW ────────────────────────────
  {
    name: "Citrix-to-RDS Migration SoW",
    description: "Statement of Work template for migrating from Citrix XenApp/XenDesktop to Microsoft Remote Desktop Services, including user profiling, application packaging, and phased cutover.",
    category: "workflow",
    buildPlan: {
      name: "Citrix-to-RDS Migration SoW",
      description: "SoW generation for Citrix-to-RDS migrations",
      agentGraph: [
        { agentId: "document-analysis", layer: 2, description: "Analyze existing Citrix environment docs", inputs: ["citrix_config_export"], outputs: ["environment_analysis"] },
        { agentId: "tech-infra", layer: 1, domainId: "TECH", description: "Validate RDS architecture recommendations", inputs: ["environment_analysis"], outputs: ["architecture_review"] },
        { agentId: "cost-analyzer", layer: 2, description: "Compare Citrix licensing vs RDS licensing costs", inputs: ["environment_analysis", "user_count"], outputs: ["cost_comparison"] },
        { agentId: "sow-generator", layer: 3, description: "Generate migration SoW", inputs: ["architecture_review", "cost_comparison"], outputs: ["sow_document"] },
      ],
      tools: [],
      schemas: [
        { tableName: "migration_assessments", fields: [{ name: "id", type: "uuid" }, { name: "tenant_id", type: "uuid" }, { name: "source_platform", type: "text" }, { name: "target_platform", type: "text" }, { name: "user_count", type: "integer" }, { name: "findings", type: "jsonb" }], rls: true },
      ],
      uiWireframes: [
        { route: "/migration/citrix-rds", component: "CitrixMigrationWizard", description: "Guided Citrix-to-RDS migration assessment" },
      ],
      rbacMatrix: [
        { role: "msp_admin", resource: "migration_assessments", actions: ["create", "read", "update", "delete"] },
        { role: "msp_tech", resource: "migration_assessments", actions: ["create", "read", "update"] },
      ],
      testScenarios: [
        { name: "Generate migration SoW for 50 users", category: "functional", input: { userCount: 50, citrixVersion: "7.15" }, expectedOutcome: "pass" },
        { name: "Handle missing Citrix config gracefully", category: "functional", input: { userCount: 50 }, expectedOutcome: "degrade" },
        { name: "Cross-tenant data isolation", category: "tenant_isolation", input: { userCount: 10 }, expectedOutcome: "pass" },
      ],
    },
    templateCode: [],
    variables: [
      { key: "TENANT_NAME", label: "MSP Name", type: "string", required: true },
      { key: "CITRIX_VERSION", label: "Source Citrix Version", type: "select", options: ["7.15", "1912 LTSR", "2203 LTSR", "2402 LTSR"], required: false },
      { key: "TARGET_OS", label: "Target RDS OS", type: "select", options: ["Windows Server 2022", "Windows Server 2025"], defaultValue: "Windows Server 2022", required: false },
    ],
    tags: ["sow", "migration", "citrix", "rds", "virtualization"],
    version: "1.0.0",
    tenantId: null,
  },

  // ── 3. IT Due Diligence Report ────────────────────────────────
  {
    name: "IT Due Diligence Report",
    description: "M&A IT due diligence assessment template covering infrastructure, security, compliance, licensing, and operational risk scoring for acquisition targets.",
    category: "workflow",
    buildPlan: {
      name: "IT Due Diligence Report",
      description: "Structured IT due diligence for M&A transactions",
      agentGraph: [
        { agentId: "document-analysis", layer: 2, description: "Ingest target company IT documentation", inputs: ["uploaded_docs"], outputs: ["doc_analysis"] },
        { agentId: "data-extractor", layer: 2, description: "Extract infrastructure inventory from docs", inputs: ["doc_analysis"], outputs: ["infra_inventory"] },
        { agentId: "risk-scorer", layer: 2, description: "Score IT risk across dimensions", inputs: ["infra_inventory", "security_findings"], outputs: ["risk_scores"] },
        { agentId: "compliance-checker", layer: 2, description: "Evaluate compliance posture", inputs: ["doc_analysis"], outputs: ["compliance_gaps"] },
        { agentId: "report-generator", layer: 2, description: "Generate formatted DD report", inputs: ["risk_scores", "compliance_gaps", "infra_inventory"], outputs: ["dd_report"] },
      ],
      tools: [],
      schemas: [
        { tableName: "dd_engagements", fields: [{ name: "id", type: "uuid" }, { name: "tenant_id", type: "uuid" }, { name: "target_name", type: "text" }, { name: "status", type: "varchar" }, { name: "findings", type: "jsonb" }, { name: "risk_score", type: "real" }], rls: true },
      ],
      uiWireframes: [
        { route: "/diligence/new", component: "DDEngagementWizard", description: "New due diligence engagement setup" },
        { route: "/diligence/:id", component: "DDDashboard", description: "Engagement dashboard with risk heatmap" },
      ],
      rbacMatrix: [
        { role: "msp_admin", resource: "dd_engagements", actions: ["create", "read", "update", "delete"] },
        { role: "client_admin", resource: "dd_engagements", actions: ["read"] },
      ],
      testScenarios: [
        { name: "Generate DD report with full inputs", category: "functional", input: { targetName: "Acme Corp" }, expectedOutcome: "pass" },
        { name: "PHI boundary test — no PII in risk output", category: "phi_boundary", input: { targetName: "Test Corp" }, expectedOutcome: "pass" },
        { name: "Tenant isolation on DD engagement", category: "tenant_isolation", input: {}, expectedOutcome: "pass" },
      ],
    },
    templateCode: [],
    variables: [
      { key: "TENANT_NAME", label: "MSP Name", type: "string", required: true },
      { key: "REPORT_BRANDING", label: "Report Header Logo URL", type: "string", required: false },
      { key: "RISK_WEIGHT_SECURITY", label: "Security Risk Weight", type: "number", defaultValue: 30, required: false },
    ],
    tags: ["diligence", "m&a", "risk", "compliance", "meridian"],
    version: "1.0.0",
    tenantId: null,
  },

  // ── 4. HIPAA Risk Assessment ──────────────────────────────────
  {
    name: "HIPAA Risk Assessment",
    description: "HIPAA Security Rule risk assessment template aligned to 45 CFR Parts 160/164, covering administrative, physical, and technical safeguards with gap analysis and remediation recommendations.",
    category: "workflow",
    buildPlan: {
      name: "HIPAA Risk Assessment",
      description: "Structured HIPAA risk assessment with compliance scoring",
      agentGraph: [
        { agentId: "hipaa", layer: 1, domainId: "HIPAA", description: "HIPAA compliance knowledge base", inputs: ["assessment_responses"], outputs: ["compliance_guidance"] },
        { agentId: "compliance-checker", layer: 2, description: "Evaluate responses against HIPAA requirements", inputs: ["assessment_responses", "compliance_guidance"], outputs: ["gap_analysis"] },
        { agentId: "risk-scorer", layer: 2, description: "Score risk per safeguard category", inputs: ["gap_analysis"], outputs: ["risk_scores"] },
        { agentId: "report-generator", layer: 2, description: "Generate HIPAA risk assessment report", inputs: ["gap_analysis", "risk_scores"], outputs: ["hipaa_report"] },
      ],
      tools: [],
      schemas: [
        { tableName: "hipaa_assessments", fields: [{ name: "id", type: "uuid" }, { name: "tenant_id", type: "uuid" }, { name: "client_id", type: "uuid" }, { name: "status", type: "varchar" }, { name: "responses", type: "jsonb" }, { name: "findings", type: "jsonb" }, { name: "risk_level", type: "varchar" }], rls: true },
      ],
      uiWireframes: [
        { route: "/hipaa/assess", component: "HIPAAAssessmentWizard", description: "Guided HIPAA risk assessment questionnaire" },
        { route: "/hipaa/:id/report", component: "HIPAAReport", description: "Generated risk assessment report" },
      ],
      rbacMatrix: [
        { role: "msp_admin", resource: "hipaa_assessments", actions: ["create", "read", "update", "delete"] },
        { role: "msp_tech", resource: "hipaa_assessments", actions: ["create", "read", "update"] },
        { role: "client_admin", resource: "hipaa_assessments", actions: ["read"] },
      ],
      testScenarios: [
        { name: "Complete HIPAA assessment with valid responses", category: "functional", input: { safeguardType: "administrative" }, expectedOutcome: "pass" },
        { name: "PHI never appears in assessment output", category: "phi_boundary", input: { safeguardType: "technical" }, expectedOutcome: "pass" },
        { name: "Only 45 CFR 160/164 references in guidance", category: "security", input: {}, expectedOutcome: "pass" },
      ],
    },
    templateCode: [],
    variables: [
      { key: "TENANT_NAME", label: "MSP Name", type: "string", required: true },
      { key: "COVERED_ENTITY_NAME", label: "Covered Entity Name", type: "string", required: true },
      { key: "ASSESSMENT_YEAR", label: "Assessment Year", type: "string", defaultValue: "2026", required: false },
    ],
    tags: ["hipaa", "compliance", "healthcare", "risk-assessment", "security"],
    version: "1.0.0",
    tenantId: null,
  },

  // ── 5. Security Posture Scan ──────────────────────────────────
  {
    name: "Security Posture Scan",
    description: "Automated external security posture assessment template using NIST CSF and CIS Controls mapping, including Cavaridge Adjusted Score calculation.",
    category: "workflow",
    buildPlan: {
      name: "Security Posture Scan",
      description: "External security scan with Cavaridge Adjusted Score",
      agentGraph: [
        { agentId: "cyber", layer: 1, domainId: "CYBER", description: "Cybersecurity knowledge base (NIST CSF, CIS)", inputs: ["scan_results"], outputs: ["framework_mapping"] },
        { agentId: "risk-scorer", layer: 2, description: "Calculate Cavaridge Adjusted Score", inputs: ["scan_results", "framework_mapping", "compensating_controls"], outputs: ["adjusted_score"] },
        { agentId: "report-generator", layer: 2, description: "Generate security posture report", inputs: ["adjusted_score", "framework_mapping"], outputs: ["posture_report"] },
      ],
      tools: [
        { name: "external_scan", description: "Run external port/TLS/DNS scan", parameters: { target_domain: "string" } },
      ],
      schemas: [
        { tableName: "security_scans", fields: [{ name: "id", type: "uuid" }, { name: "tenant_id", type: "uuid" }, { name: "target_domain", type: "text" }, { name: "scan_results", type: "jsonb" }, { name: "adjusted_score", type: "real" }, { name: "status", type: "varchar" }], rls: true },
      ],
      uiWireframes: [
        { route: "/scan/new", component: "ScanLauncher", description: "Initiate new security scan" },
        { route: "/scan/:id", component: "ScanResults", description: "Scan results with score breakdown" },
      ],
      rbacMatrix: [
        { role: "msp_admin", resource: "security_scans", actions: ["create", "read", "update", "delete"] },
        { role: "msp_tech", resource: "security_scans", actions: ["create", "read"] },
        { role: "client_admin", resource: "security_scans", actions: ["read"] },
        { role: "prospect", resource: "security_scans", actions: ["read"] },
      ],
      testScenarios: [
        { name: "Scan valid domain and produce score", category: "functional", input: { targetDomain: "example.com" }, expectedOutcome: "pass" },
        { name: "Reject internal IP scan attempt", category: "security", input: { targetDomain: "192.168.1.1" }, expectedOutcome: "fail" },
        { name: "Score within 0-100 range", category: "functional", input: { targetDomain: "test.com" }, expectedOutcome: "pass" },
      ],
    },
    templateCode: [],
    variables: [
      { key: "TENANT_NAME", label: "MSP Name", type: "string", required: true },
      { key: "SCORE_WEIGHTS", label: "Score Weight Config", type: "json", required: false, description: "JSON object with signal weights" },
    ],
    tags: ["security", "posture", "scan", "aegis", "cis", "nist"],
    version: "1.0.0",
    tenantId: null,
  },

  // ── 6. QBR Package ────────────────────────────────────────────
  {
    name: "QBR Package",
    description: "Quarterly Business Review package template with IT roadmap status, security scoring trends, budget tracking, and executive summary generation.",
    category: "workflow",
    buildPlan: {
      name: "QBR Package",
      description: "Automated QBR report generation",
      agentGraph: [
        { agentId: "data-extractor", layer: 2, description: "Pull roadmap and ticket data", inputs: ["tenant_data"], outputs: ["quarterly_data"] },
        { agentId: "cost-analyzer", layer: 2, description: "Budget vs actuals analysis", inputs: ["quarterly_data"], outputs: ["financial_summary"] },
        { agentId: "report-generator", layer: 2, description: "Generate QBR deck/PDF", inputs: ["quarterly_data", "financial_summary", "security_scores"], outputs: ["qbr_package"] },
      ],
      tools: [],
      schemas: [
        { tableName: "qbr_reports", fields: [{ name: "id", type: "uuid" }, { name: "tenant_id", type: "uuid" }, { name: "client_id", type: "uuid" }, { name: "quarter", type: "varchar" }, { name: "content", type: "jsonb" }, { name: "status", type: "varchar" }], rls: true },
      ],
      uiWireframes: [
        { route: "/qbr/generate", component: "QBRGenerator", description: "QBR package generation wizard" },
        { route: "/qbr/:id", component: "QBRViewer", description: "Interactive QBR viewer with drill-down" },
      ],
      rbacMatrix: [
        { role: "msp_admin", resource: "qbr_reports", actions: ["create", "read", "update", "delete"] },
        { role: "msp_tech", resource: "qbr_reports", actions: ["read"] },
        { role: "client_admin", resource: "qbr_reports", actions: ["read"] },
      ],
      testScenarios: [
        { name: "Generate QBR for Q1 with complete data", category: "functional", input: { quarter: "Q1-2026" }, expectedOutcome: "pass" },
        { name: "Client admin cannot modify QBR", category: "rbac", input: { action: "update" }, expectedOutcome: "fail" },
        { name: "QBR scoped to single client", category: "tenant_isolation", input: {}, expectedOutcome: "pass" },
      ],
    },
    templateCode: [],
    variables: [
      { key: "TENANT_NAME", label: "MSP Name", type: "string", required: true },
      { key: "QUARTER_FORMAT", label: "Quarter Label Format", type: "select", options: ["Q1-YYYY", "Q1 YYYY", "1Q YYYY"], defaultValue: "Q1-YYYY", required: false },
      { key: "INCLUDE_SECURITY_SCORE", label: "Include Security Score Section", type: "boolean", defaultValue: true, required: false },
    ],
    tags: ["qbr", "reporting", "midas", "roadmap", "executive"],
    version: "1.0.0",
    tenantId: null,
  },

  // ── 7. Tenant Onboarding ──────────────────────────────────────
  {
    name: "Tenant Onboarding",
    description: "Automated MSP or client tenant onboarding workflow including tenant provisioning, user invitation, RMM connector setup, and initial configuration.",
    category: "workflow",
    buildPlan: {
      name: "Tenant Onboarding",
      description: "End-to-end tenant onboarding automation",
      agentGraph: [
        { agentId: "data-extractor", layer: 2, description: "Extract org data from onboarding form", inputs: ["onboarding_form"], outputs: ["org_data"] },
      ],
      tools: [
        { name: "provision_tenant", description: "Create tenant record with UTM hierarchy", parameters: { name: "string", type: "string", parentId: "string" } },
        { name: "send_invites", description: "Send user invitations", parameters: { emails: "string[]", role: "string" } },
      ],
      schemas: [
        { tableName: "onboarding_sessions", fields: [{ name: "id", type: "uuid" }, { name: "tenant_id", type: "uuid" }, { name: "status", type: "varchar" }, { name: "steps_completed", type: "jsonb" }, { name: "config", type: "jsonb" }], rls: true },
      ],
      uiWireframes: [
        { route: "/onboard", component: "OnboardingWizard", description: "Multi-step tenant onboarding wizard" },
        { route: "/onboard/:id/status", component: "OnboardingStatus", description: "Onboarding progress tracker" },
      ],
      rbacMatrix: [
        { role: "platform_admin", resource: "onboarding_sessions", actions: ["create", "read", "update", "delete"] },
        { role: "msp_admin", resource: "onboarding_sessions", actions: ["create", "read", "update"] },
      ],
      testScenarios: [
        { name: "Onboard new MSP tenant", category: "functional", input: { tenantName: "Test MSP", tenantType: "msp" }, expectedOutcome: "pass" },
        { name: "Prevent client self-onboarding without MSP", category: "rbac", input: { tenantType: "client" }, expectedOutcome: "fail" },
        { name: "Tenant isolation during onboarding", category: "tenant_isolation", input: {}, expectedOutcome: "pass" },
      ],
    },
    templateCode: [],
    variables: [
      { key: "PLATFORM_NAME", label: "Platform Name", type: "string", defaultValue: "Cavaridge", required: false },
      { key: "DEFAULT_PLAN_TIER", label: "Default Plan Tier", type: "select", options: ["starter", "professional", "enterprise"], defaultValue: "starter", required: false },
      { key: "AUTO_INVITE", label: "Auto-send Invitations", type: "boolean", defaultValue: true, required: false },
    ],
    tags: ["onboarding", "tenant", "provisioning", "automation"],
    version: "1.0.0",
    tenantId: null,
  },

  // ── 8. PSA Ticket Agent ───────────────────────────────────────
  {
    name: "PSA Ticket Agent",
    description: "AI-powered ticket triage and enrichment agent template for PSA-lite integration, including auto-categorization, priority scoring, SLA assignment, and routing.",
    category: "agent",
    buildPlan: {
      name: "PSA Ticket Agent",
      description: "Intelligent ticket processing agent",
      agentGraph: [
        { agentId: "tech-infra", layer: 1, domainId: "TECH", description: "Technical knowledge for categorization", inputs: ["ticket_content"], outputs: ["tech_context"] },
        { agentId: "data-extractor", layer: 2, description: "Extract entities from ticket text", inputs: ["ticket_content"], outputs: ["extracted_entities"] },
      ],
      tools: [
        { name: "classify_ticket", description: "Classify ticket category and subcategory", parameters: { content: "string" } },
        { name: "assign_priority", description: "Calculate priority based on SLA and impact", parameters: { category: "string", clientTier: "string" } },
        { name: "route_ticket", description: "Route to appropriate tech queue", parameters: { category: "string", priority: "string" } },
      ],
      schemas: [],
      uiWireframes: [],
      rbacMatrix: [
        { role: "msp_admin", resource: "tickets", actions: ["create", "read", "update", "delete"] },
        { role: "msp_tech", resource: "tickets", actions: ["create", "read", "update"] },
        { role: "client_admin", resource: "tickets", actions: ["create", "read"] },
      ],
      testScenarios: [
        { name: "Classify network outage ticket", category: "functional", input: { content: "Internet is down at main office" }, expectedOutcome: "pass" },
        { name: "No PII leakage in classification output", category: "phi_boundary", input: { content: "User john.doe@test.com cannot login" }, expectedOutcome: "pass" },
        { name: "Respect tenant boundaries in routing", category: "tenant_isolation", input: {}, expectedOutcome: "pass" },
      ],
    },
    templateCode: [],
    variables: [
      { key: "TENANT_NAME", label: "MSP Name", type: "string", required: true },
      { key: "SLA_TIERS", label: "SLA Tier Configuration", type: "json", required: false, description: "JSON object defining SLA response/resolution times per tier" },
      { key: "AUTO_ROUTE", label: "Auto-route Tickets", type: "boolean", defaultValue: false, required: false },
    ],
    tags: ["psa", "ticket", "agent", "triage", "cavalier", "automation"],
    version: "1.0.0",
    tenantId: null,
  },

  // ── 9. React Dashboard ────────────────────────────────────────
  {
    name: "React Dashboard",
    description: "Scaffold for a multi-tenant React dashboard with Tailwind CSS, shadcn/ui components, light/dark/system theme, tenant-scoped data fetching, and Ducky Intelligence branding.",
    category: "app",
    buildPlan: {
      name: "React Dashboard",
      description: "Multi-tenant React dashboard scaffold",
      agentGraph: [],
      tools: [],
      schemas: [],
      uiWireframes: [
        { route: "/", component: "DashboardLayout", description: "Main dashboard shell with sidebar nav", layout: "sidebar" },
        { route: "/dashboard", component: "DashboardHome", description: "Overview cards with key metrics" },
        { route: "/settings", component: "Settings", description: "Tenant and user settings" },
      ],
      rbacMatrix: [
        { role: "msp_admin", resource: "dashboard", actions: ["read", "configure"] },
        { role: "msp_tech", resource: "dashboard", actions: ["read"] },
        { role: "client_admin", resource: "dashboard", actions: ["read"] },
        { role: "client_viewer", resource: "dashboard", actions: ["read"] },
      ],
      testScenarios: [
        { name: "Dashboard loads for authenticated user", category: "functional", input: {}, expectedOutcome: "pass" },
        { name: "Unauthenticated user redirected to login", category: "security", input: {}, expectedOutcome: "pass" },
        { name: "Theme toggle persists preference", category: "functional", input: { theme: "dark" }, expectedOutcome: "pass" },
      ],
    },
    templateCode: [
      { path: "src/App.tsx", content: "import { ThemeProvider } from './components/theme-provider';\nimport { DashboardLayout } from './components/layout';\n// {{APP_NAME}} Dashboard\nexport default function App() {\n  return (\n    <ThemeProvider>\n      <DashboardLayout />\n    </ThemeProvider>\n  );\n}", placeholders: ["APP_NAME"] },
      { path: "src/components/layout.tsx", content: "// Dashboard layout with sidebar\n// Powered by Ducky Intelligence\nexport function DashboardLayout() { return null; }", placeholders: [] },
      { path: "tailwind.config.ts", content: "import type { Config } from 'tailwindcss';\nexport default { darkMode: 'class', content: ['./src/**/*.{ts,tsx}'] } satisfies Config;", placeholders: [] },
    ],
    variables: [
      { key: "APP_NAME", label: "Application Name", type: "string", required: true },
      { key: "PRIMARY_COLOR", label: "Primary Brand Color", type: "string", defaultValue: "#2E5090", required: false },
      { key: "ENABLE_DARK_MODE", label: "Enable Dark Mode", type: "boolean", defaultValue: true, required: false },
    ],
    tags: ["react", "dashboard", "scaffold", "ui", "tailwind", "shadcn"],
    version: "1.0.0",
    tenantId: null,
  },

  // ── 10. Express API Service ───────────────────────────────────
  {
    name: "Express API Service",
    description: "Scaffold for a multi-tenant Express 5 API service with Drizzle ORM, Supabase auth middleware, tenant-scoped RLS, health checks, and Spaniel LLM integration.",
    category: "app",
    buildPlan: {
      name: "Express API Service",
      description: "Multi-tenant Express API scaffold",
      agentGraph: [],
      tools: [],
      schemas: [
        { tableName: "{{TABLE_NAME}}", fields: [{ name: "id", type: "uuid" }, { name: "tenant_id", type: "uuid" }, { name: "created_at", type: "timestamp" }, { name: "updated_at", type: "timestamp" }], rls: true },
      ],
      uiWireframes: [],
      rbacMatrix: [
        { role: "platform_admin", resource: "api", actions: ["*"] },
        { role: "msp_admin", resource: "api", actions: ["create", "read", "update", "delete"] },
        { role: "msp_tech", resource: "api", actions: ["create", "read", "update"] },
        { role: "client_admin", resource: "api", actions: ["read"] },
      ],
      testScenarios: [
        { name: "Health check returns 200", category: "functional", input: { endpoint: "/health" }, expectedOutcome: "pass" },
        { name: "Unauthenticated request returns 401", category: "security", input: { endpoint: "/api/v1/resource" }, expectedOutcome: "pass" },
        { name: "Tenant header enforced on all routes", category: "tenant_isolation", input: {}, expectedOutcome: "pass" },
      ],
    },
    templateCode: [
      { path: "src/server.ts", content: "import express from 'express';\nimport { authMiddleware } from '@cavaridge/auth';\nimport { healthRouter } from './routes/health.js';\n\nconst app = express();\napp.use(express.json());\napp.use('/health', healthRouter);\napp.use(authMiddleware());\n// {{APP_NAME}} API — v{{VERSION}}\nexport default app;", placeholders: ["APP_NAME", "VERSION"] },
      { path: "src/routes/health.ts", content: "import { Router } from 'express';\nexport const healthRouter = Router();\nhealthRouter.get('/', (_req, res) => res.json({ status: 'ok' }));", placeholders: [] },
      { path: "src/db/schema.ts", content: "import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';\n\nexport const {{TABLE_NAME}} = pgTable('{{TABLE_NAME}}', {\n  id: uuid('id').primaryKey().defaultRandom(),\n  tenantId: uuid('tenant_id').notNull(),\n  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),\n  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),\n});", placeholders: ["TABLE_NAME"] },
    ],
    variables: [
      { key: "APP_NAME", label: "Service Name", type: "string", required: true },
      { key: "VERSION", label: "Initial Version", type: "string", defaultValue: "1.0.0", required: false },
      { key: "TABLE_NAME", label: "Primary Table Name", type: "string", required: true, description: "Snake_case name for the primary DB table" },
      { key: "PORT", label: "Server Port", type: "number", defaultValue: 3000, required: false },
    ],
    tags: ["express", "api", "scaffold", "backend", "drizzle", "supabase"],
    version: "1.0.0",
    tenantId: null,
  },
];

/**
 * Insert all 10 seed blueprints into the database.
 * Skips any blueprint whose name already exists (idempotent).
 * Optionally indexes each blueprint for semantic search.
 */
export async function seedBlueprints(
  registry: BlueprintRegistry,
  search?: BlueprintSearch
): Promise<Blueprint[]> {
  const results: Blueprint[] = [];

  // Get existing blueprint names to avoid duplicates
  const existing = await registry.list({ tenantId: null, limit: 100 });
  const existingNames = new Set(existing.map((b) => b.name));

  for (const seed of SEED_BLUEPRINTS) {
    if (existingNames.has(seed.name)) {
      continue;
    }

    const created = await registry.create(seed);
    results.push(created);

    if (search) {
      await search.indexBlueprint(created.id);
    }
  }

  return results;
}

// Re-export for convenience
export type { Blueprint } from "./types.js";
