/**
 * Microsoft Graph API — Type Definitions for CVG-ASTRA
 *
 * Lightweight interfaces matching Graph API response shapes.
 * We define these instead of importing @microsoft/microsoft-graph-types
 * to keep dependencies light and avoid version coupling.
 */

// ── OAuth / Token Management ────────────────────────────────────────

export interface GraphTokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  /** Azure AD tenant ID extracted from JWT claims */
  azureTenantId: string;
}

export interface GraphTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface GraphJwtClaims {
  aud?: string;
  iss?: string;
  tid?: string;
  sub?: string;
  oid?: string;
  upn?: string;
  [key: string]: unknown;
}

// ── Users ───────────────────────────────────────────────────────────

export interface GraphUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail?: string;
  department?: string;
  jobTitle?: string;
  city?: string;
  country?: string;
  accountEnabled: boolean;
  assignedLicenses: GraphAssignedLicense[];
  assignedPlans?: GraphAssignedPlan[];
  signInActivity?: GraphSignInActivity;
  createdDateTime?: string;
  lastPasswordChangeDateTime?: string;
}

export interface GraphAssignedLicense {
  skuId: string;
  disabledPlans?: string[];
}

export interface GraphAssignedPlan {
  assignedDateTime?: string;
  capabilityStatus?: string;
  service?: string;
  servicePlanId?: string;
}

export interface GraphSignInActivity {
  lastSignInDateTime?: string;
  lastSignInRequestId?: string;
  lastNonInteractiveSignInDateTime?: string;
  lastNonInteractiveSignInRequestId?: string;
}

// ── Subscribed SKUs (License Inventory) ─────────────────────────────

export interface GraphSubscribedSku {
  skuId: string;
  skuPartNumber: string;
  capabilityStatus: string;
  appliesTo: string;
  consumedUnits: number;
  prepaidUnits: GraphPrepaidUnits;
  servicePlans?: GraphServicePlan[];
}

export interface GraphPrepaidUnits {
  enabled: number;
  suspended: number;
  warning: number;
  lockedOut?: number;
}

export interface GraphServicePlan {
  servicePlanId: string;
  servicePlanName: string;
  provisioningStatus: string;
  appliesTo: string;
}

// ── Group-Based Licensing ───────────────────────────────────────────

export interface GraphGroup {
  id: string;
  displayName: string;
  description?: string;
  assignedLicenses: GraphAssignedLicense[];
  memberCount?: number;
}

export interface GraphGroupMember {
  id: string;
  displayName: string;
  userPrincipalName: string;
}

// ── Usage / Activity Reports ────────────────────────────────────────

export interface GraphOffice365ActiveUserDetail {
  userPrincipalName: string;
  displayName: string;
  isDeleted: boolean;
  deletedDate?: string;
  hasExchangeLicense: boolean;
  hasOneDriveLicense: boolean;
  hasSharePointLicense: boolean;
  hasTeamsLicense: boolean;
  hasYammerLicense: boolean;
  hasSkypeForBusinessLicense: boolean;
  exchangeLastActivityDate?: string;
  oneDriveLastActivityDate?: string;
  sharePointLastActivityDate?: string;
  teamsLastActivityDate?: string;
  yammerLastActivityDate?: string;
  skypeForBusinessLastActivityDate?: string;
  assignedProducts: string[];
  reportRefreshDate: string;
}

export interface GraphMailboxUsageDetail {
  userPrincipalName: string;
  displayName: string;
  storageUsedInBytes: number;
  issueWarningQuotaInBytes: number;
  prohibitSendQuotaInBytes: number;
  prohibitSendReceiveQuotaInBytes: number;
  itemCount: number;
  reportRefreshDate: string;
  isDeleted: boolean;
}

// ── Organization / Directory ────────────────────────────────────────

export interface GraphOrganization {
  id: string;
  displayName: string;
  verifiedDomains: GraphVerifiedDomain[];
  technicalNotificationMails: string[];
  tenantType?: string;
}

export interface GraphVerifiedDomain {
  name: string;
  isDefault: boolean;
  isInitial: boolean;
  type: string;
}

// ── Paginated Response ──────────────────────────────────────────────

export interface GraphPagedResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
  "@odata.count"?: number;
}

// ── Service Plan Detail Mapping ─────────────────────────────────────

export type ServicePlanCategory =
  | "exchange"
  | "teams"
  | "sharepoint"
  | "onedrive"
  | "security"
  | "compliance"
  | "intune"
  | "identity"
  | "power_platform"
  | "other";

export interface ServicePlanMapping {
  planId: string;
  planName: string;
  category: ServicePlanCategory;
  /** Features available in this plan that are not in lower tiers */
  premiumFeatures: string[];
}

// ── Aggregated License Data (Astra-specific) ────────────────────────

export interface LicensedUserProfile {
  id: string;
  displayName: string;
  userPrincipalName: string;
  department: string;
  jobTitle: string;
  city: string;
  country: string;
  accountEnabled: boolean;
  licenses: string[];
  monthlyCost: number;
  lastSignIn?: Date;
  activity?: UserServiceActivity;
  mailboxUsageGB?: number;
  mailboxQuotaGB?: number;
}

export interface UserServiceActivity {
  exchangeActive: boolean;
  teamsActive: boolean;
  sharePointActive: boolean;
  oneDriveActive: boolean;
  yammerActive: boolean;
  skypeActive: boolean;
  exchangeLastDate: string | null;
  teamsLastDate: string | null;
  sharePointLastDate: string | null;
  oneDriveLastDate: string | null;
  yammerLastDate: string | null;
  skypeLastDate: string | null;
  activeServiceCount: number;
  totalServiceCount: number;
  daysSinceLastActivity: number | null;
}

export interface SkuSummary {
  skuId: string;
  skuPartNumber: string;
  displayName: string;
  costPerUser: number;
  totalEnabled: number;
  totalConsumed: number;
  totalAvailable: number;
  capabilityStatus: string;
  servicePlans: GraphServicePlan[];
}
