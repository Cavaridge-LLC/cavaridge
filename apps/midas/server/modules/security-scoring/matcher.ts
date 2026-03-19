/**
 * Matcher Engine — matches unimplemented native controls against
 * compensating control catalog and MSP overrides.
 */

import type {
  NativeControl,
  MatchResult,
  DetectionSignal,
  ScoreConfidence,
  CompensationLevel,
} from "@shared/types/security-scoring";
import type { CatalogEntry, ScoringOverride } from "@shared/schema";
import * as storage from "../../storage";
import { findCatalogMatchesForControl } from "./catalog";

// ── Types ────────────────────────────────────────────────────────────

export interface DetectedSignal {
  signalType: DetectionSignal["signalType"];
  value: string;
}

// ── Main Matcher ─────────────────────────────────────────────────────

export async function matchCompensatingControls(
  orgId: string,
  clientId: string,
  nativeControls: NativeControl[],
  detectedSignals: DetectedSignal[] = [],
): Promise<MatchResult[]> {
  const overrides = await storage.getOverrides(orgId, clientId);
  const overrideMap = new Map(overrides.map((o) => [o.nativeControlId, o]));
  const results: MatchResult[] = [];

  for (const control of nativeControls) {
    if (control.isNotApplicable) {
      results.push({
        controlId: control.controlId,
        controlName: control.controlName,
        category: control.category,
        status: "not_applicable",
        confidence: "high",
        source: "native",
        maxScore: control.maxScore,
        awardedScore: 0,
      });
      continue;
    }

    if (control.isImplemented) {
      results.push({
        controlId: control.controlId,
        controlName: control.controlName,
        category: control.category,
        status: "implemented",
        confidence: "high",
        source: "native",
        maxScore: control.maxScore,
        awardedScore: control.maxScore,
      });
      continue;
    }

    // Check MSP overrides first (highest priority)
    const override = overrideMap.get(control.controlId);
    if (override) {
      const result = applyOverride(control, override);
      if (result) {
        results.push(result);
        continue;
      }
    }

    // Check auto-detected signals against catalog
    const catalogMatches = await findCatalogMatchesForControl(
      control.controlId,
      control.vendor,
    );

    if (catalogMatches.length > 0 && detectedSignals.length > 0) {
      const autoMatch = matchSignalsToCatalog(control, catalogMatches, detectedSignals);
      if (autoMatch) {
        results.push(autoMatch);
        continue;
      }
    }

    // No match — real gap
    results.push({
      controlId: control.controlId,
      controlName: control.controlName,
      category: control.category,
      status: "real_gap",
      confidence: "high",
      source: "native",
      maxScore: control.maxScore,
      awardedScore: 0,
    });
  }

  return results;
}

// ── Override Application ─────────────────────────────────────────────

function applyOverride(
  control: NativeControl,
  override: ScoringOverride,
): MatchResult | null {
  if (override.overrideType === "reject_auto") {
    return null; // Fall through to catalog/gap
  }

  const isExpired = override.expiresAt && new Date(override.expiresAt) < new Date();
  const level = override.compensationLevel as CompensationLevel | "none";

  if (level === "none") return null;

  const confidence: ScoreConfidence = isExpired
    ? "low"
    : override.overrideType === "confirm_auto"
      ? "high"
      : "medium";

  const multiplier = level === "full" ? 1 : 0.5;

  return {
    controlId: control.controlId,
    controlName: control.controlName,
    category: control.category,
    status: level === "full" ? "compensated" : "partial",
    compensationLevel: level,
    thirdPartyProduct: override.thirdPartyProduct ?? undefined,
    confidence,
    source: "msp_override",
    maxScore: control.maxScore,
    awardedScore: Math.round(control.maxScore * multiplier),
  };
}

// ── Signal-to-Catalog Matching ───────────────────────────────────────

function matchSignalsToCatalog(
  control: NativeControl,
  catalogEntries: CatalogEntry[],
  detectedSignals: DetectedSignal[],
): MatchResult | null {
  for (const entry of catalogEntries) {
    const products = entry.thirdPartyProducts as Array<{
      productName: string;
      vendorName: string;
      detectionSignals: DetectionSignal[];
      satisfiesIntent: string;
    }>;

    for (const product of products) {
      for (const expectedSignal of product.detectionSignals) {
        if (expectedSignal.signalType === "manual") continue;

        const match = detectedSignals.find(
          (s) =>
            s.signalType === expectedSignal.signalType &&
            new RegExp(expectedSignal.signalPattern, "i").test(s.value),
        );

        if (match) {
          const level = entry.compensationLevel as CompensationLevel;
          const multiplier = level === "full" ? 1 : 0.5;

          return {
            controlId: control.controlId,
            controlName: control.controlName,
            category: control.category,
            status: level === "full" ? "compensated" : "partial",
            compensationLevel: level,
            thirdPartyProduct: product.productName,
            confidence: "medium", // Auto-detected but not yet MSP-confirmed
            source: "auto_detected",
            maxScore: control.maxScore,
            awardedScore: Math.round(control.maxScore * multiplier),
          };
        }
      }
    }
  }

  return null;
}
