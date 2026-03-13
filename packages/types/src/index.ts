export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  tenantId: string;
  role: string;
  displayName?: string;
}

export interface AuditEntry {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export type EvidenceLevel = "OBSERVED" | "REPRESENTED" | "UNVERIFIED";
export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export * from "./agent";
