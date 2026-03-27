/**
 * Credit Check Middleware
 *
 * Express middleware that validates a tenant has sufficient credits
 * before allowing content generation to proceed. Returns 402 Payment
 * Required when the balance is insufficient.
 *
 * Usage: apply before any content generation endpoint.
 *   app.post("/api/v1/content", ...canCreate, creditCheck, handler)
 */

import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../auth";
import type { ForgeBrief } from "@shared/models/pipeline";
import {
  getCreditBalance,
  estimateCreditCost,
  hasEnoughCredits,
  PLAN_CONFIGS,
} from "../services/credit-engine";

// Extend Express Request to carry the credit estimate downstream
declare module "express" {
  interface Request {
    /** Estimated credit cost attached by credit-check middleware */
    creditEstimate?: number;
    /** Tenant credit balance snapshot at time of check */
    creditBalance?: {
      available: number;
      total: number;
      tier: string;
      isUnlimited: boolean;
    };
  }
}

/**
 * Middleware: checks tenant credit balance against estimated cost.
 *
 * Expects the request body to contain brief fields (description, contentType, etc.)
 * or a `brief` object. Attaches `req.creditEstimate` for downstream use.
 *
 * - Enterprise tenants: always pass (unlimited credits).
 * - Insufficient credits: 402 with balance details and upgrade guidance.
 */
export function creditCheck(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const tenantId = req.tenantId;

  if (!tenantId) {
    res.status(401).json({
      error: "Authentication required",
      type: "UnauthorizedError",
      statusCode: 401,
    });
    return;
  }

  // Build a partial brief from the request body for estimation
  const body = req.body ?? {};
  const brief: ForgeBrief = {
    description: body.description ?? "",
    outputFormat: body.outputFormat ?? "pdf",
    contentType: body.contentType ?? "custom",
    audience: body.audience,
    tone: body.tone,
    referenceNotes: body.referenceNotes,
    brandVoiceId: body.brandVoiceId,
  };

  const estimatedCredits = estimateCreditCost(brief);

  // Async balance check
  Promise.all([
    getCreditBalance(tenantId),
    hasEnoughCredits(tenantId, estimatedCredits),
  ])
    .then(([balance, hasSufficient]) => {
      // Attach estimate and balance to request for downstream handlers
      req.creditEstimate = estimatedCredits;
      req.creditBalance = {
        available: balance.isUnlimited ? Infinity : balance.availableCredits,
        total: balance.totalCredits,
        tier: balance.tier,
        isUnlimited: balance.isUnlimited,
      };

      if (balance.isUnlimited || hasSufficient) {
        next();
        return;
      }

      // Determine upgrade path
      const currentTier = balance.tier;
      const tierOrder = ["free", "starter", "professional", "enterprise"] as const;
      const currentIndex = tierOrder.indexOf(currentTier as typeof tierOrder[number]);
      const nextTier = currentIndex < tierOrder.length - 1
        ? tierOrder[currentIndex + 1]
        : null;
      const nextTierConfig = nextTier ? PLAN_CONFIGS[nextTier] : null;

      res.status(402).json({
        error: "Insufficient credits",
        type: "InsufficientCreditsError",
        statusCode: 402,
        details: {
          required: estimatedCredits,
          available: balance.availableCredits,
          tier: balance.tier,
          deficit: estimatedCredits - balance.availableCredits,
          upgrade: nextTierConfig
            ? {
                tier: nextTierConfig.tier,
                monthlyCredits: nextTierConfig.monthlyCredits,
                priceUsd: nextTierConfig.priceUsd,
              }
            : null,
        },
      });
    })
    .catch((err) => {
      console.error("Credit check failed:", err);
      // Fail open would be dangerous for billing — fail closed instead
      res.status(500).json({
        error: "Credit verification unavailable. Please try again.",
        type: "InternalError",
        statusCode: 500,
      });
    });
}
