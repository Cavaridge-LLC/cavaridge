/**
 * AEGIS Integration Types — CVG-MIDAS
 *
 * Cross-app interface for consuming AEGIS Adjusted Score
 * and security findings. AEGIS → MIDAS data flow.
 */

import type { SecurityCategory } from "./security-scoring";

// ── AEGIS Score Payload ─────────────────────────────────────────────

export interface AegisScorePayload {
  clientId: string;
  tenantId: string;
  capturedAt: string;

  /** Cavaridge Adjusted Score 0-100 */
  adjustedScore: number;

  /** Raw Microsoft/Google native score */
  nativeScore: number;
  nativeMaxScore: number;

  /** Score signal breakdown (weights configurable per MSP) */
  signals: AegisScoreSignal[];

  /** Compensating controls bonus (max +5) */
  compensatingBonus: number;

  /** Browser security compliance score (from extension telemetry) */
  browserSecurityScore: number | null;

  /** DNS filtering compliance (from Cloudflare Gateway) */
  dnsComplianceScore: number | null;

  /** Credential hygiene score (HIBP breach data) */
  credentialHygieneScore: number | null;

  /** SaaS shadow IT risk score */
  shadowItRiskScore: number | null;
}

export interface AegisScoreSignal {
  source: string;
  weight: number;
  rawScore: number;
  weightedScore: number;
}

// ── AEGIS Finding ───────────────────────────────────────────────────

export interface AegisSecurityFinding {
  findingId: string;
  tenantId: string;
  clientId: string;
  category: SecurityCategory;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  remediation: string;
  source: "extension" | "dns" | "credential" | "scanner" | "config";
  detectedAt: string;
  resolvedAt: string | null;
  pointsAtStake: number;
}

// ── AEGIS → Midas QBR Integration ───────────────────────────────────

export interface AegisQbrData {
  score: AegisScorePayload;
  findings: AegisSecurityFinding[];
  unresolvedCount: number;
  resolvedSinceLastQbr: number;
}
