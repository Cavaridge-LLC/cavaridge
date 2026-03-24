import { db } from "./db";
import {
  tenants, users, deals, pillars, findings, dealAccess,
  documents, documentChunks, baselineProfiles,
  invitations, auditLog, usageTracking, platformSettings,
  accountRequests, processingQueue, techStackItems,
  baselineComparisons, playbookPhases, playbookTasks, scoreSnapshots,
  pillarTemplates, techCategories,
} from "@shared/schema";
import { sql } from "drizzle-orm";
import crypto from "crypto";

function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, buf) => {
      if (err) reject(err);
      else resolve(`${salt}:${buf.toString("hex")}`);
    });
  });
}

const PILLAR_NAMES = [
  "Infrastructure & Architecture",
  "Cybersecurity Posture",
  "Regulatory Compliance",
  "Integration Complexity",
  "Technology Org & Talent",
  "Data Assets & Governance",
];

const INDUSTRY_WEIGHTS: Record<string, number[]> = {
  "Healthcare":          [0.15, 0.20, 0.25, 0.15, 0.10, 0.15],
  "Financial Services":  [0.15, 0.20, 0.25, 0.15, 0.10, 0.15],
  "Manufacturing":       [0.20, 0.25, 0.15, 0.20, 0.10, 0.10],
  "Technology/SaaS":     [0.20, 0.15, 0.15, 0.20, 0.20, 0.10],
  "Retail":              [0.20, 0.15, 0.20, 0.20, 0.10, 0.15],
};

export async function seedDatabase() {
  const existingOrgs = await db.select().from(tenants).limit(1);
  if (existingOrgs.length > 0) {
    console.log("Seed data already exists, skipping.");
    return;
  }

  console.log("Starting complete seed data reset...");

  await db.transaction(async (tx) => {
    // STEP 1: Wipe all data in FK-safe order
    console.log("Step 1: Wiping all existing data...");
    await tx.delete(processingQueue);
    await tx.delete(documentChunks);
    await tx.delete(findings);
    await tx.delete(pillars);
    await tx.delete(documents);
    await tx.delete(dealAccess);
    await tx.delete(scoreSnapshots);
    await tx.delete(playbookTasks);
    await tx.delete(playbookPhases);
    await tx.delete(baselineComparisons);
    await tx.delete(techStackItems);
    await tx.delete(deals);
    await tx.delete(usageTracking);
    await tx.delete(invitations);
    await tx.delete(accountRequests);
    await tx.delete(auditLog);
    await tx.delete(baselineProfiles);
    await tx.delete(platformSettings);
    await tx.execute(sql`UPDATE tenants SET owner_user_id = NULL`);
    await tx.delete(users);
    await tx.delete(tenants);
    console.log("  All tables cleared.");

    // STEP 2: Create organizations
    console.log("Step 2: Creating organizations...");
    const [cavaridge] = await tx.insert(tenants).values({
      name: "Cavaridge, LLC",
      slug: "cavaridge",
      type: "platform",
      planTier: "enterprise",
      maxUsers: 9999,
      isActive: true,
    } as any).returning();

    const [contoso] = await tx.insert(tenants).values({
      name: "Contoso Capital Partners",
      slug: "contoso-capital",
      type: "msp",
      planTier: "professional",
      maxUsers: 25,
      isActive: true,
    } as any).returning();
    console.log(`  Cavaridge id: ${cavaridge.id}`);
    console.log(`  Contoso id: ${contoso.id}`);

    // STEP 3: Create users with bcrypt hashes (cost 12)
    console.log("Step 3: Creating users...");
    const benHash = await hashPassword("Meridian2026!");
    const contosoHash = await hashPassword("Contoso2026!");
    console.log(`  Ben password hash: ${benHash}`);
    console.log(`  Contoso password hash: ${contosoHash}`);

    const [ben] = await tx.insert(users).values({
      displayName: "Benjamin Posner",
      email: "ben@cavaridge.com",
      role: "platform_admin",
      isPlatformUser: true,
      tenantId: cavaridge.id,
      status: "active",
    } as any).returning();

    await tx.update(tenants).set({ ownerUserId: ben.id }).where(sql`id = ${cavaridge.id}`);

    const [alex] = await tx.insert(users).values({
      displayName: "Alex Johnson",
      email: "alex.johnson@contoso-capital.com",
      role: "msp_admin",
      isPlatformUser: false,
      tenantId: contoso.id,
      status: "active",
    } as any).returning();

    await tx.update(tenants).set({ ownerUserId: alex.id }).where(sql`id = ${contoso.id}`);

    const [sarah] = await tx.insert(users).values({
      displayName: "Sarah Chen",
      email: "sarah.chen@contoso-capital.com",
      role: "msp_tech",
      isPlatformUser: false,
      tenantId: contoso.id,
      status: "active",
    } as any).returning();

    const [mike] = await tx.insert(users).values({
      displayName: "Mike Torres",
      email: "mike.torres@contoso-capital.com",
      role: "msp_tech",
      isPlatformUser: false,
      tenantId: contoso.id,
      status: "active",
    } as any).returning();

    console.log(`  Created: Ben(${ben.id}), Alex(${alex.id}), Sarah(${sarah.id}), Mike(${mike.id})`);

    // STEP 4: Create deals (all under Contoso)
    console.log("Step 4: Creating deals...");
    const dealData = [
      { dealCode: "MRD-2026-001", targetName: "Northwind Medical Group", industry: "Healthcare", stage: "Active Diligence", status: "on-track", facilityCount: 8, userCount: 340, estimatedIntegrationCost: "$1.2M", compositeScore: "72" },
      { dealCode: "MRD-2026-002", targetName: "Fabrikam Financial", industry: "Financial Services", stage: "Preliminary Review", status: "at-risk", facilityCount: 5, userCount: 420, estimatedIntegrationCost: "$2.8M", compositeScore: "54" },
      { dealCode: "MRD-2026-003", targetName: "Tailspin Technologies", industry: "Technology/SaaS", stage: "Data Room Open", status: "ahead", facilityCount: 2, userCount: 180, estimatedIntegrationCost: "$340K", compositeScore: "88" },
      { dealCode: "MRD-2026-004", targetName: "Adventure Works Manufacturing", industry: "Manufacturing", stage: "Integration Planning", status: "on-track", facilityCount: 12, userCount: 890, estimatedIntegrationCost: "$3.1M", compositeScore: "67" },
      { dealCode: "MRD-2026-005", targetName: "Wide World Retail", industry: "Retail", stage: "Active Diligence", status: "at-risk", facilityCount: 45, userCount: 2100, estimatedIntegrationCost: "$4.5M", compositeScore: "61" },
    ];

    const createdDeals = [];
    for (const d of dealData) {
      const [deal] = await tx.insert(deals).values({
        tenantId: contoso.id,
        dealCode: d.dealCode,
        targetName: d.targetName,
        industry: d.industry,
        stage: d.stage,
        status: d.status,
        facilityCount: d.facilityCount,
        userCount: d.userCount,
        estimatedIntegrationCost: d.estimatedIntegrationCost,
        compositeScore: d.compositeScore,
        overallConfidence: "insufficient",
        documentsUploaded: 0,
        documentsAnalyzed: 0,
      }).returning();
      createdDeals.push(deal);
    }
    console.log(`  Created ${createdDeals.length} deals`);

    // STEP 5: Create pillars
    console.log("Step 5: Creating pillars...");
    const northwindScores = [3.8, 3.2, 3.5, 4.1, 3.9, 3.6];
    const northwindFindingCounts = [1, 2, 2, 1, 1, 1];

    const allPillars: Record<string, any[]> = {};

    for (let di = 0; di < createdDeals.length; di++) {
      const deal = createdDeals[di];
      const weights = INDUSTRY_WEIGHTS[dealData[di].industry] || INDUSTRY_WEIGHTS["Healthcare"];
      const isNorthwind = di === 0;
      const dealPillars = [];

      for (let pi = 0; pi < PILLAR_NAMES.length; pi++) {
        const [pillar] = await tx.insert(pillars).values({
          dealId: deal.id,
          pillarName: PILLAR_NAMES[pi],
          score: isNorthwind ? String(northwindScores[pi]) : "3.0",
          weight: String(weights[pi]),
          findingCount: isNorthwind ? northwindFindingCounts[pi] : 0,
          evidenceConfidence: "0",
          confidenceLabel: "insufficient",
          documentCount: 0,
          scoreCap: "3.0",
        }).returning();
        dealPillars.push(pillar);
      }
      allPillars[deal.id] = dealPillars;
    }
    console.log(`  Created ${Object.values(allPillars).flat().length} pillars`);

    // STEP 6: Create findings (for Deal 1 — Northwind)
    console.log("Step 6: Creating findings...");
    const northwindDeal = createdDeals[0];
    const northwindPillars = allPillars[northwindDeal.id];
    const cyberPillar = northwindPillars[1];
    const compliancePillar = northwindPillars[2];
    const infraPillar = northwindPillars[0];
    const integrationPillar = northwindPillars[3];
    const orgPillar = northwindPillars[4];
    const dataPillar = northwindPillars[5];

    const findingsData = [
      { pillarId: cyberPillar.id, severity: "critical", title: "No MFA on administrative accounts", description: "Domain admin, VPN, and RMM accounts lack multi-factor authentication. 37 privileged accounts identified with password-only auth.", impactEstimate: "$85K remediation + ongoing $12K/yr MFA licensing", sourceCount: 3, status: "open" },
      { pillarId: cyberPillar.id, severity: "high", title: "End-of-life firewall firmware", description: "Primary Palo Alto PA-3020 running PAN-OS 8.1 (EOL Dec 2022). No security patches for 3+ years. Secondary site on SonicWall TZ300 also EOL.", impactEstimate: "$45K firewall replacement", sourceCount: 2, status: "open" },
      { pillarId: compliancePillar.id, severity: "critical", title: "HIPAA risk assessment overdue by 18 months", description: "Last documented HIPAA security risk assessment dated June 2024. OCR requires annual assessment. No evidence of remediation tracking.", impactEstimate: "$25K assessment + potential $50K-$250K OCR penalty exposure", sourceCount: 4, status: "open" },
      { pillarId: compliancePillar.id, severity: "medium", title: "Incomplete BAA coverage", description: "Business Associate Agreements missing for 3 of 11 vendors with PHI access: cloud backup provider, IT helpdesk contractor, and document shredding service.", impactEstimate: "$8K legal review and execution", sourceCount: 2, status: "open" },
      { pillarId: infraPillar.id, severity: "high", title: "Single point of failure — primary DC", description: "All production workloads run from a single server closet at main facility. No redundant power, no generator, single ISP. Estimated 4-hour RTO if site goes down.", impactEstimate: "$120K for colo migration or redundancy build", sourceCount: 2, status: "acknowledged" },
      { pillarId: integrationPillar.id, severity: "medium", title: "EHR system on legacy on-prem deployment", description: "eClinicalWorks v11 running on-premises with custom interfaces to billing and lab systems. Vendor quotes 6-month timeline for cloud migration.", impactEstimate: "$200K migration + 6 months timeline risk", sourceCount: 3, status: "open" },
      { pillarId: orgPillar.id, severity: "medium", title: "IT team key-person dependency", description: "Single network administrator manages all infrastructure across 8 facilities. No backup, no documentation. Institutional knowledge risk.", impactEstimate: "$95K/yr additional FTE + $15K knowledge transfer", sourceCount: 1, status: "open" },
      { pillarId: dataPillar.id, severity: "low", title: "No formal data classification policy", description: "PHI, PII, and general business data commingled on shared drives. No DLP controls. Users have broad access to file shares.", impactEstimate: "$15K policy development + $20K DLP tooling", sourceCount: 2, status: "open" },
    ];

    for (const f of findingsData) {
      await tx.insert(findings).values({
        dealId: northwindDeal.id,
        pillarId: f.pillarId,
        severity: f.severity,
        title: f.title,
        description: f.description,
        impactEstimate: f.impactEstimate,
        sourceDocuments: [],
        sourceCount: f.sourceCount,
        status: f.status,
      });
    }
    console.log(`  Created ${findingsData.length} findings`);

    // STEP 7: Create deal access records
    console.log("Step 7: Creating deal access records...");
    for (const deal of createdDeals) {
      await tx.insert(dealAccess).values({
        dealId: deal.id,
        userId: alex.id,
        accessLevel: "lead",
        grantedBy: alex.id,
      });
    }
    for (let i = 0; i < 3; i++) {
      await tx.insert(dealAccess).values({
        dealId: createdDeals[i].id,
        userId: sarah.id,
        accessLevel: "contributor",
        grantedBy: alex.id,
      });
    }
    for (let i = 3; i < 5; i++) {
      await tx.insert(dealAccess).values({
        dealId: createdDeals[i].id,
        userId: mike.id,
        accessLevel: "contributor",
        grantedBy: alex.id,
      });
    }
    console.log("  Created 10 deal access records");

    // STEP 8: Create baseline profiles
    console.log("Step 8: Creating baseline profiles...");
    const baselineData = {
      infrastructure: { min_redundancy: "N+1", max_server_age_years: 5, required_backup_frequency: "daily", required_rto_hours: 4, required_rpo_hours: 1 },
      cybersecurity: { mfa_required: true, endpoint_protection_required: true, siem_required: true, pentest_frequency: "annual", patch_sla_critical_days: 14 },
      compliance: { risk_assessment_frequency: "annual", required_frameworks: ["SOC2", "HIPAA"], baa_coverage_required: true, incident_response_plan_required: true },
      integration: { max_acceptable_legacy_systems: 3, cloud_readiness_required: true, api_preference: "REST", sso_required: true },
      organization: { min_it_staff_ratio: 50, documentation_required: true, cross_training_required: true },
      data: { classification_policy_required: true, dlp_required: true, encryption_at_rest_required: true, retention_policy_required: true },
    };

    await tx.insert(baselineProfiles).values({
      tenantId: contoso.id,
      name: "Standard Acquirer Baseline",
      isDefault: true,
      profileData: baselineData,
    });

    await tx.insert(baselineProfiles).values({
      tenantId: cavaridge.id,
      name: "Platform Default Baseline",
      isDefault: true,
      profileData: baselineData,
    });
    console.log("  Created 2 baseline profiles");

    // STEP 9: Seed platform settings
    console.log("Step 9: Seeding platform settings...");
    const settingsEntries = [
      { settingKey: "platform_name", settingValue: "MERIDIAN" },
      { settingKey: "platform_version", settingValue: "2.0.0" },
      { settingKey: "registration_mode", settingValue: "request" },
      { settingKey: "default_plan_tier", settingValue: "starter" },
      { settingKey: "maintenance_mode", settingValue: false },
      { settingKey: "allowed_email_domains", settingValue: [] },
    ];

    for (const s of settingsEntries) {
      await tx.insert(platformSettings).values({
        settingKey: s.settingKey,
        settingValue: s.settingValue,
        updatedBy: ben.id,
      });
    }
    console.log("  Created 6 platform settings");

    console.log("Step 10: Seeding pillar templates (platform defaults)...");
    const pillarDescs = [
      "Server, network, cloud, and data center infrastructure assessment",
      "Security controls, vulnerability management, and threat posture",
      "Regulatory framework compliance and audit readiness",
      "Application architecture complexity and integration challenges",
      "IT team structure, capabilities, and key-person risk",
      "Data management, governance policies, and information assets",
    ];
    const defaultWeight = "0.167";
    for (let i = 0; i < PILLAR_NAMES.length; i++) {
      await tx.insert(pillarTemplates).values({
        name: PILLAR_NAMES[i],
        description: pillarDescs[i],
        weight: i === 5 ? "0.165" : defaultWeight,
        isDefault: true,
        tenantId: null,
        displayOrder: i,
      });
    }
    console.log(`  Created ${PILLAR_NAMES.length} default pillar templates`);

    console.log("Step 11: Seeding tech categories (platform defaults)...");
    const defaultCategories = [
      { name: "Compute & Virtualization", description: "Servers, VMs, hypervisors, and container platforms" },
      { name: "Networking", description: "Routers, switches, firewalls, load balancers, SD-WAN" },
      { name: "Storage & Backup", description: "SAN, NAS, cloud storage, backup solutions, DR" },
      { name: "Cloud Services", description: "IaaS, PaaS, SaaS cloud platforms and services" },
      { name: "Security", description: "Endpoint protection, SIEM, IAM, DLP, encryption" },
      { name: "Collaboration", description: "Email, messaging, video conferencing, file sharing" },
      { name: "Business Applications", description: "ERP, CRM, HRM, financial systems" },
      { name: "Clinical/Industry Systems", description: "EHR, PACS, LIS, vertical-specific applications" },
      { name: "Development & DevOps", description: "CI/CD, source control, monitoring, observability" },
      { name: "Database", description: "RDBMS, NoSQL, data warehousing, analytics platforms" },
      { name: "End User Computing", description: "Desktops, laptops, MDM, VDI, printing" },
      { name: "Telecommunications", description: "VoIP, PBX, contact center, unified communications" },
    ];
    for (let i = 0; i < defaultCategories.length; i++) {
      await tx.insert(techCategories).values({
        name: defaultCategories[i].name,
        description: defaultCategories[i].description,
        displayOrder: i,
        isDefault: true,
        tenantId: null,
      });
    }
    console.log(`  Created ${defaultCategories.length} default tech categories`);
  });

  console.log("\n=== Seed complete. Running verification queries... ===\n");

  const orgResults = await db.execute(sql`SELECT name, slug, plan_tier, is_active FROM tenants ORDER BY name`);
  console.log("Organizations:", JSON.stringify(orgResults.rows, null, 2));

  const userResults = await db.execute(sql`
    SELECT name, email, role, is_platform_user, status,
      CASE WHEN password_hash IS NOT NULL AND password_hash LIKE '$2%'
           THEN 'HASHED ✓' ELSE 'MISSING ✗' END as password_status
    FROM users ORDER BY role, name
  `);
  console.log("Users:", JSON.stringify(userResults.rows, null, 2));

  const dealResults = await db.execute(sql`SELECT deal_code, target_name, industry, stage, composite_score FROM deals ORDER BY deal_code`);
  console.log("Deals:", JSON.stringify(dealResults.rows, null, 2));

  const dealOwnership = await db.execute(sql`SELECT d.target_name, t.id as tenant_id FROM meridian.deals d JOIN tenants t ON d.tenant_id = t.id`);
  console.log("Deal Ownership:", JSON.stringify(dealOwnership.rows, null, 2));

  const pillarCounts = await db.execute(sql`SELECT d.target_name, COUNT(p.id) as pillar_count FROM deals d LEFT JOIN pillars p ON d.id = p.deal_id GROUP BY d.target_name ORDER BY d.target_name`);
  console.log("Pillar Counts:", JSON.stringify(pillarCounts.rows, null, 2));

  const findingCount = await db.execute(sql`SELECT COUNT(*) as finding_count FROM findings`);
  console.log("Findings:", JSON.stringify(findingCount.rows, null, 2));

  const accessCounts = await db.execute(sql`SELECT u.name, COUNT(da.id) as deals_accessible FROM users u LEFT JOIN deal_access da ON u.id = da.user_id WHERE u.is_platform_user = false GROUP BY u.name ORDER BY u.name`);
  console.log("Deal Access:", JSON.stringify(accessCounts.rows, null, 2));

  const profiles = await db.execute(sql`SELECT t.id as tenant_id, bp.name as profile_name FROM meridian.baseline_profiles bp JOIN tenants t ON bp.tenant_id = t.id`);
  console.log("Baseline Profiles:", JSON.stringify(profiles.rows, null, 2));

  const loginCheck = await db.execute(sql`SELECT email, CASE WHEN password_hash IS NOT NULL AND LENGTH(password_hash) > 50 THEN 'READY ✓' ELSE 'BROKEN ✗' END as login_ready FROM users WHERE email = 'ben@cavaridge.com'`);
  console.log("Login Check:", JSON.stringify(loginCheck.rows, null, 2));

  console.log("\n=== Seed data reset complete! ===");
}
