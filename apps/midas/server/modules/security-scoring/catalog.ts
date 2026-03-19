/**
 * Compensating Controls Catalog — MVP seed data and catalog service.
 *
 * The catalog is config-driven (stored in Supabase), not code-driven.
 * This module provides the MVP seed data from the addendum Section 3.2
 * and helper functions for querying catalog entries.
 */

import * as storage from "../../storage";
import type { InsertCatalogEntry } from "@shared/schema";
import type { ThirdPartyProduct, SecurityCategory } from "@shared/types/security-scoring";

// ── MVP Catalog Seed Data ────────────────────────────────────────────

interface CatalogSeedEntry {
  nativeControlId: string;
  nativeControlName: string;
  vendor: "microsoft" | "google";
  category: SecurityCategory;
  thirdPartyProducts: ThirdPartyProduct[];
  compensationLevel: "full" | "partial";
  notes?: string;
}

const MVP_CATALOG: CatalogSeedEntry[] = [
  {
    nativeControlId: "ms-mfa-all-users",
    nativeControlName: "Require MFA for all users",
    vendor: "microsoft",
    category: "identity_mfa",
    compensationLevel: "full",
    thirdPartyProducts: [
      { productName: "Duo Security", vendorName: "Cisco", detectionSignals: [{ signalType: "service_principal", signalPattern: "duo" }], satisfiesIntent: "Provides MFA for all user accounts with push, SMS, and hardware token options" },
      { productName: "Okta Verify", vendorName: "Okta", detectionSignals: [{ signalType: "service_principal", signalPattern: "okta" }], satisfiesIntent: "Cloud-based MFA with adaptive risk policies" },
      { productName: "JumpCloud Protect", vendorName: "JumpCloud", detectionSignals: [{ signalType: "service_principal", signalPattern: "jumpcloud" }], satisfiesIntent: "Directory-integrated MFA with push notifications" },
      { productName: "AuthPoint", vendorName: "WatchGuard", detectionSignals: [{ signalType: "service_principal", signalPattern: "watchguard" }], satisfiesIntent: "Hardware and software token-based MFA" },
    ],
  },
  {
    nativeControlId: "ms-risk-based-mfa",
    nativeControlName: "Enable risk-based MFA policies",
    vendor: "microsoft",
    category: "identity_mfa",
    compensationLevel: "full",
    thirdPartyProducts: [
      { productName: "Duo Adaptive MFA", vendorName: "Cisco", detectionSignals: [{ signalType: "service_principal", signalPattern: "duo" }], satisfiesIntent: "Risk-based authentication with device trust and location awareness" },
      { productName: "Okta Adaptive MFA", vendorName: "Okta", detectionSignals: [{ signalType: "service_principal", signalPattern: "okta" }], satisfiesIntent: "Context-aware MFA with risk scoring" },
    ],
  },
  {
    nativeControlId: "ms-safe-attachments",
    nativeControlName: "Enable Safe Attachments (Defender)",
    vendor: "microsoft",
    category: "email_protection",
    compensationLevel: "full",
    thirdPartyProducts: [
      { productName: "Proofpoint Email Protection", vendorName: "Proofpoint", detectionSignals: [{ signalType: "dns_record", signalPattern: "pphosted\\.com" }], satisfiesIntent: "Advanced attachment sandboxing and threat detection" },
      { productName: "Mimecast Targeted Threat Protection", vendorName: "Mimecast", detectionSignals: [{ signalType: "dns_record", signalPattern: "mimecast" }], satisfiesIntent: "Attachment scanning with sandbox detonation" },
      { productName: "Barracuda Email Security Gateway", vendorName: "Barracuda", detectionSignals: [{ signalType: "dns_record", signalPattern: "barracuda" }], satisfiesIntent: "Email attachment filtering and sandboxing" },
    ],
  },
  {
    nativeControlId: "ms-safe-links",
    nativeControlName: "Enable Safe Links (Defender)",
    vendor: "microsoft",
    category: "email_protection",
    compensationLevel: "full",
    thirdPartyProducts: [
      { productName: "Proofpoint URL Defense", vendorName: "Proofpoint", detectionSignals: [{ signalType: "dns_record", signalPattern: "pphosted\\.com" }], satisfiesIntent: "URL rewriting and time-of-click analysis" },
      { productName: "Mimecast URL Protect", vendorName: "Mimecast", detectionSignals: [{ signalType: "dns_record", signalPattern: "mimecast" }], satisfiesIntent: "URL scanning with browser isolation" },
    ],
  },
  {
    nativeControlId: "ms-anti-phishing",
    nativeControlName: "Anti-phishing policies",
    vendor: "microsoft",
    category: "email_protection",
    compensationLevel: "full",
    thirdPartyProducts: [
      { productName: "Proofpoint", vendorName: "Proofpoint", detectionSignals: [{ signalType: "dns_record", signalPattern: "pphosted\\.com" }], satisfiesIntent: "AI-powered anti-phishing with impersonation detection" },
      { productName: "Mimecast", vendorName: "Mimecast", detectionSignals: [{ signalType: "dns_record", signalPattern: "mimecast" }], satisfiesIntent: "Brand impersonation and social engineering detection" },
      { productName: "IRONSCALES", vendorName: "IRONSCALES", detectionSignals: [{ signalType: "service_principal", signalPattern: "ironscales" }], satisfiesIntent: "AI + human-verified phishing detection and remediation" },
      { productName: "Abnormal Security", vendorName: "Abnormal", detectionSignals: [{ signalType: "service_principal", signalPattern: "abnormal" }], satisfiesIntent: "Behavioral AI phishing and BEC detection" },
    ],
  },
  {
    nativeControlId: "ms-defender-endpoint",
    nativeControlName: "Enable Microsoft Defender for Endpoint",
    vendor: "microsoft",
    category: "endpoint_protection",
    compensationLevel: "full",
    thirdPartyProducts: [
      { productName: "SentinelOne Singularity", vendorName: "SentinelOne", detectionSignals: [{ signalType: "service_principal", signalPattern: "sentinelone" }, { signalType: "installed_agent", signalPattern: "SentinelAgent" }], satisfiesIntent: "AI-powered EDR with autonomous response" },
      { productName: "CrowdStrike Falcon", vendorName: "CrowdStrike", detectionSignals: [{ signalType: "service_principal", signalPattern: "crowdstrike" }, { signalType: "installed_agent", signalPattern: "CSFalcon" }], satisfiesIntent: "Cloud-native EDR with threat intelligence" },
      { productName: "Sophos Intercept X", vendorName: "Sophos", detectionSignals: [{ signalType: "installed_agent", signalPattern: "Sophos" }], satisfiesIntent: "Deep learning-based endpoint protection" },
      { productName: "Bitdefender GravityZone", vendorName: "Bitdefender", detectionSignals: [{ signalType: "installed_agent", signalPattern: "Bitdefender" }], satisfiesIntent: "Layered endpoint protection with risk analytics" },
    ],
  },
  {
    nativeControlId: "ms-attack-surface-reduction",
    nativeControlName: "Enable attack surface reduction rules",
    vendor: "microsoft",
    category: "endpoint_protection",
    compensationLevel: "partial",
    notes: "Third-party EDR provides similar behavioral blocking but may not cover all ASR rule categories",
    thirdPartyProducts: [
      { productName: "SentinelOne Storyline", vendorName: "SentinelOne", detectionSignals: [{ signalType: "service_principal", signalPattern: "sentinelone" }], satisfiesIntent: "Behavioral detection and process tree analysis" },
      { productName: "CrowdStrike Falcon Prevent", vendorName: "CrowdStrike", detectionSignals: [{ signalType: "service_principal", signalPattern: "crowdstrike" }], satisfiesIntent: "Pre-execution and runtime behavioral prevention" },
    ],
  },
  {
    nativeControlId: "ms-cloud-backup",
    nativeControlName: "Enable cloud backup",
    vendor: "microsoft",
    category: "backup_recovery",
    compensationLevel: "full",
    thirdPartyProducts: [
      { productName: "Veeam Backup for Microsoft 365", vendorName: "Veeam", detectionSignals: [{ signalType: "service_principal", signalPattern: "veeam" }], satisfiesIntent: "Full M365 backup including Exchange, SharePoint, OneDrive, Teams" },
      { productName: "Acronis Cyber Protect Cloud", vendorName: "Acronis", detectionSignals: [{ signalType: "service_principal", signalPattern: "acronis" }], satisfiesIntent: "Integrated backup with anti-malware scanning" },
      { productName: "Datto SaaS Protection", vendorName: "Datto", detectionSignals: [{ signalType: "service_principal", signalPattern: "datto" }], satisfiesIntent: "Automated M365 and Google Workspace backup" },
      { productName: "Axcient x360Cloud", vendorName: "Axcient", detectionSignals: [{ signalType: "manual", signalPattern: "axcient" }], satisfiesIntent: "MSP-focused cloud backup with chain-free technology" },
    ],
  },
  {
    nativeControlId: "ms-device-compliance",
    nativeControlName: "Require device compliance (Intune)",
    vendor: "microsoft",
    category: "device_management",
    compensationLevel: "full",
    thirdPartyProducts: [
      { productName: "JumpCloud MDM", vendorName: "JumpCloud", detectionSignals: [{ signalType: "service_principal", signalPattern: "jumpcloud" }], satisfiesIntent: "Cross-platform device management and compliance" },
      { productName: "Kandji", vendorName: "Kandji", detectionSignals: [{ signalType: "manual", signalPattern: "kandji" }], satisfiesIntent: "Apple device management with compliance blueprints" },
      { productName: "Mosyle", vendorName: "Mosyle", detectionSignals: [{ signalType: "manual", signalPattern: "mosyle" }], satisfiesIntent: "Apple-first MDM with automated compliance" },
    ],
  },
  {
    nativeControlId: "ms-dlp-policies",
    nativeControlName: "Enable DLP policies",
    vendor: "microsoft",
    category: "data_protection",
    compensationLevel: "full",
    thirdPartyProducts: [
      { productName: "Proofpoint DLP", vendorName: "Proofpoint", detectionSignals: [{ signalType: "service_principal", signalPattern: "proofpoint" }], satisfiesIntent: "Content-aware DLP across email, cloud, and endpoints" },
      { productName: "Netskope DLP", vendorName: "Netskope", detectionSignals: [{ signalType: "service_principal", signalPattern: "netskope" }], satisfiesIntent: "Cloud-native DLP with inline and API-based inspection" },
      { productName: "Code42 Incydr", vendorName: "Code42", detectionSignals: [{ signalType: "service_principal", signalPattern: "code42" }], satisfiesIntent: "Insider risk detection and data exfiltration prevention" },
    ],
  },
  {
    nativeControlId: "ms-audit-log",
    nativeControlName: "Enable audit log search",
    vendor: "microsoft",
    category: "logging_monitoring",
    compensationLevel: "full",
    thirdPartyProducts: [
      { productName: "Blumira SIEM", vendorName: "Blumira", detectionSignals: [{ signalType: "service_principal", signalPattern: "blumira" }], satisfiesIntent: "Automated SIEM with M365 log ingestion and threat detection" },
      { productName: "Huntress Managed SIEM", vendorName: "Huntress", detectionSignals: [{ signalType: "service_principal", signalPattern: "huntress" }], satisfiesIntent: "MDR with M365 log monitoring and incident response" },
      { productName: "Arctic Wolf", vendorName: "Arctic Wolf", detectionSignals: [{ signalType: "manual", signalPattern: "arcticwolf" }], satisfiesIntent: "24/7 SOC with cloud log monitoring" },
      { productName: "Todyl MXDR", vendorName: "Todyl", detectionSignals: [{ signalType: "manual", signalPattern: "todyl" }], satisfiesIntent: "MSP-focused SIEM/SOAR with M365 integration" },
    ],
  },
  {
    nativeControlId: "ms-conditional-access",
    nativeControlName: "Enable Conditional Access",
    vendor: "microsoft",
    category: "network_security",
    compensationLevel: "full",
    thirdPartyProducts: [
      { productName: "JumpCloud Conditional Access", vendorName: "JumpCloud", detectionSignals: [{ signalType: "service_principal", signalPattern: "jumpcloud" }], satisfiesIntent: "Device trust and location-based access policies" },
      { productName: "Okta Access Policies", vendorName: "Okta", detectionSignals: [{ signalType: "service_principal", signalPattern: "okta" }], satisfiesIntent: "Contextual access management with device assurance" },
    ],
  },
];

// ── Seed Function ────────────────────────────────────────────────────

export async function seedCatalog(): Promise<number> {
  const existing = await storage.getCatalogEntries();
  if (existing.length > 0) return existing.length;

  let count = 0;
  for (const entry of MVP_CATALOG) {
    await storage.createCatalogEntry({
      nativeControlId: entry.nativeControlId,
      nativeControlName: entry.nativeControlName,
      vendor: entry.vendor,
      category: entry.category,
      thirdPartyProducts: entry.thirdPartyProducts,
      compensationLevel: entry.compensationLevel,
      notes: entry.notes ?? null,
      lastVerified: new Date(),
    } as InsertCatalogEntry);
    count++;
  }
  return count;
}

// ── Catalog Query Helpers ────────────────────────────────────────────

export async function findCatalogMatchesForControl(
  nativeControlId: string,
  vendor: "microsoft" | "google",
): Promise<CatalogEntry[]> {
  const entries = await storage.getCatalogByControl(nativeControlId);
  return entries.filter((e) => e.vendor === vendor);
}

export { getCatalogEntries, createCatalogEntry, updateCatalogEntry } from "../../storage";
