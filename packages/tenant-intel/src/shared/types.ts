/**
 * @cavaridge/tenant-intel — Vendor-neutral normalized types
 *
 * All connector data normalizes to these types. Consuming applications
 * never deal with Graph-specific or Google-specific shapes.
 */

// ── Source Vendor ────────────────────────────────────────────────────

export type SourceVendor = "microsoft" | "google";

// ── Tenant User ─────────────────────────────────────────────────────

export interface TenantUser {
  id: string;
  tenantId: string;
  sourceVendor: SourceVendor;
  sourceId: string;
  displayName: string;
  email: string;
  userPrincipalName?: string;
  department?: string;
  jobTitle?: string;
  accountEnabled: boolean;
  licenses: NormalizedLicense[];
  lastSignIn?: Date;
  mfaEnabled: boolean;
  mfaMethod?: string;
  isAdmin: boolean;
  adminRoles?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ── License ─────────────────────────────────────────────────────────

export interface NormalizedLicense {
  skuName: string;
  skuId: string;
  assignedDate?: Date;
  lastActiveDate?: Date;
  utilizationScore: number;
  services: ServiceUtilization[];
}

export interface ServiceUtilization {
  serviceName: string;
  isProvisioned: boolean;
  lastActivityDate?: Date;
  activityMetrics: Record<string, number>;
}

export interface LicenseSummary {
  skuName: string;
  skuId: string;
  totalQuantity: number;
  assignedCount: number;
  availableCount: number;
  utilizationPct: number;
  estimatedMonthlyCost?: number;
}

// ── Security ────────────────────────────────────────────────────────

export interface SecurityPosture {
  tenantId: string;
  sourceVendor: SourceVendor;
  nativeScore: number;
  maxPossibleScore: number;
  scorePct: number;
  controls: SecurityControl[];
  capturedAt: Date;
}

export interface SecurityControl {
  controlId: string;
  controlName: string;
  category: SecurityControlCategory;
  nativeStatus: "implemented" | "partial" | "not_implemented" | "not_applicable";
  pointsAchieved: number;
  maxPoints: number;
  vendorRecommendation?: string;
  compensatingControl?: CompensatingControl;
}

export type SecurityControlCategory =
  | "Identity"
  | "Data"
  | "Device"
  | "App"
  | "Infrastructure";

export interface CompensatingControl {
  toolName: string;
  toolVendor: string;
  controlDescription: string;
  pointsAwarded: number;
  detectionMethod: "auto" | "manual";
}

// ── Conditional Access ──────────────────────────────────────────────

export interface ConditionalAccessPolicy {
  id: string;
  tenantId: string;
  displayName: string;
  state: "enabled" | "disabled" | "enabledForReportingButNotEnforced";
  conditions: Record<string, unknown>;
  grantControls: Record<string, unknown>;
  sessionControls?: Record<string, unknown>;
  createdAt?: Date;
  modifiedAt?: Date;
}

// ── Device ──────────────────────────────────────────────────────────

export interface ManagedDevice {
  id: string;
  tenantId: string;
  sourceVendor: SourceVendor;
  sourceId: string;
  deviceName: string;
  operatingSystem: string;
  osVersion?: string;
  complianceState: "compliant" | "noncompliant" | "unknown" | "notEvaluated";
  isManaged: boolean;
  enrolledDateTime?: Date;
  lastSyncDateTime?: Date;
  ownerType: "company" | "personal" | "unknown";
  userPrincipalName?: string;
}

// ── Snapshot ─────────────────────────────────────────────────────────

export interface TenantSnapshot {
  id: string;
  tenantId: string;
  sourceVendor: SourceVendor;
  capturedAt: Date;
  trigger: SnapshotTrigger;
  userCount: number;
  licensedUserCount: number;
  licenseCount: number;
  securityScore: number | null;
  securityScoreMax: number | null;
  deviceCount: number;
  managedDeviceCount: number;
  conditionalAccessPolicyCount: number;
  domainNames: string[];
  dataHash: string;
}

export type SnapshotTrigger = "scheduled" | "manual" | "webhook" | "assessment";

// ── Delta / Drift ───────────────────────────────────────────────────

export interface DeltaReport {
  tenantId: string;
  fromSnapshotId: string;
  toSnapshotId: string;
  fromDate: Date;
  toDate: Date;
  changes: DeltaChange[];
  summary: DeltaSummary;
}

export interface DeltaChange {
  entity: "user" | "license" | "security_control" | "device" | "conditional_access" | "config";
  changeType: "added" | "removed" | "modified";
  entityId: string;
  entityName: string;
  field?: string;
  previousValue?: unknown;
  currentValue?: unknown;
}

export interface DeltaSummary {
  usersAdded: number;
  usersRemoved: number;
  usersModified: number;
  licensesChanged: number;
  securityScoreDelta: number | null;
  devicesAdded: number;
  devicesRemoved: number;
  policiesChanged: number;
  totalChanges: number;
}

// ── Ingestion ───────────────────────────────────────────────────────

export interface IngestOptions {
  trigger?: SnapshotTrigger;
  modules?: IngestModule[];
  forceFullSync?: boolean;
}

export type IngestModule =
  | "users"
  | "licenses"
  | "security"
  | "devices"
  | "conditional_access"
  | "applications";

export interface IngestResult {
  tenantId: string;
  snapshotId: string;
  sourceVendor: SourceVendor;
  capturedAt: Date;
  modules: IngestModuleResult[];
  durationMs: number;
  deltaReport?: DeltaReport;
}

export interface IngestModuleResult {
  module: IngestModule;
  recordCount: number;
  durationMs: number;
  error?: string;
}

// ── Activity / Usage ────────────────────────────────────────────────

export interface ActivityReport {
  tenantId: string;
  period: { from: Date; to: Date };
  activeUserCount: number;
  activeUserPct: number;
  serviceUsage: Record<string, ServiceActivitySummary>;
}

export interface ServiceActivitySummary {
  serviceName: string;
  activeUsers: number;
  totalUsers: number;
  activityPct: number;
}

// ── Query / Filter ──────────────────────────────────────────────────

export interface UserFilter {
  department?: string;
  isAdmin?: boolean;
  mfaEnabled?: boolean;
  accountEnabled?: boolean;
  hasLicense?: string;
  lastSignInBefore?: Date;
  lastSignInAfter?: Date;
}

export interface DateRange {
  from: Date;
  to: Date;
}

// ── License Utilization Report ──────────────────────────────────────

export interface LicenseUtilizationReport {
  tenantId: string;
  capturedAt: Date;
  summaries: LicenseSummary[];
  totalMonthlySpend: number | null;
  wastedLicenseCount: number;
  wastedMonthlyCost: number | null;
}

// ── Credentials ─────────────────────────────────────────────────────

export interface M365Credentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  azureTenantId: string;
}

export interface TenantIntelConfig {
  tenantId: string;
  sourceVendor: SourceVendor;
  credentials: M365Credentials;
  ingestionIntervalHours: number;
  enabledModules: IngestModule[];
}
