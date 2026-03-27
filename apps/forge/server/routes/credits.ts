/**
 * Credit API Routes — /api/v1/credits
 *
 * Endpoints for credit balance queries, cost estimation, and purchase initiation.
 */

import { Router, type Response, type NextFunction } from "express";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../auth";
import {
  getCreditBalance,
  estimateCreditCost,
  getBaseCreditCost,
  getUsageHistory,
  getUsageByContentType,
  PLAN_CONFIGS,
  type PlanTier,
} from "../services/credit-engine";
import type { ForgeBrief, ContentType } from "@shared/models/pipeline";
import { ValidationError } from "../utils/errors";

const router = Router();

const auth = [requireAuth as any]; // eslint-disable-line @typescript-eslint/no-explicit-any

// ── GET /api/v1/credits ──
// Returns current balance, usage history, and breakdown by content type.

router.get(
  "/",
  ...auth,
  requirePermission("view_credits") as any,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;

      const [balance, usageHistory, usageByType] = await Promise.all([
        getCreditBalance(tenantId),
        getUsageHistory(tenantId),
        getUsageByContentType(tenantId),
      ]);

      const planConfig = PLAN_CONFIGS[balance.tier];

      res.json({
        balance: {
          totalCredits: balance.totalCredits,
          usedCredits: balance.usedCredits,
          availableCredits: balance.isUnlimited ? "unlimited" : balance.availableCredits,
          tier: balance.tier,
          isUnlimited: balance.isUnlimited,
          resetAt: balance.resetAt,
        },
        plan: {
          tier: planConfig.tier,
          monthlyCredits: planConfig.isUnlimited ? "unlimited" : planConfig.monthlyCredits,
          priceUsd: planConfig.priceUsd,
        },
        usageHistory,
        usageByContentType: usageByType,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ── GET /api/v1/credits/estimate ──
// Estimate cost for a brief. Accepts query params: contentType, tone, brandVoiceId, referenceNotes.

router.get(
  "/estimate",
  ...auth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const contentType = (req.query.contentType as string) ?? "custom";
      const tone = req.query.tone as string | undefined;
      const brandVoiceId = req.query.brandVoiceId as string | undefined;
      const referenceNotes = req.query.referenceNotes as string | undefined;

      const brief: ForgeBrief = {
        description: "",
        outputFormat: "pdf",
        contentType: contentType as ContentType,
        tone: tone as ForgeBrief["tone"],
        brandVoiceId,
        referenceNotes,
      };

      const estimatedCredits = estimateCreditCost(brief);
      const baseCost = getBaseCreditCost(contentType);

      // Provide balance context if authenticated
      const tenantId = req.tenantId;
      let balanceInfo = null;
      if (tenantId) {
        const balance = await getCreditBalance(tenantId);
        balanceInfo = {
          availableCredits: balance.isUnlimited ? "unlimited" : balance.availableCredits,
          tier: balance.tier,
          canAfford: balance.isUnlimited || balance.availableCredits >= estimatedCredits,
        };
      }

      res.json({
        contentType,
        baseCost,
        estimatedCredits,
        multipliers: {
          referenceNotes: referenceNotes && referenceNotes.length > 100,
          complexTone: tone === "academic" || tone === "technical",
          brandVoice: !!brandVoiceId,
        },
        balance: balanceInfo,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ── POST /api/v1/credits/purchase ──
// Initiate a credit purchase. Placeholder for Stripe integration.

router.post(
  "/purchase",
  ...auth,
  requirePermission("manage_credits") as any,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const { tier } = req.body;

      if (!tier) {
        throw new ValidationError("tier is required");
      }

      const validTiers: PlanTier[] = ["starter", "professional", "enterprise"];
      if (!validTiers.includes(tier)) {
        throw new ValidationError(
          `tier must be one of: ${validTiers.join(", ")}`,
        );
      }

      const targetPlan = PLAN_CONFIGS[tier as PlanTier];
      const currentBalance = await getCreditBalance(tenantId);

      // Prevent downgrade via this endpoint
      const tierRank: Record<PlanTier, number> = {
        free: 0,
        starter: 1,
        professional: 2,
        enterprise: 3,
      };

      if (tierRank[tier as PlanTier] <= tierRank[currentBalance.tier]) {
        throw new ValidationError(
          `Cannot purchase tier "${tier}" — current tier is "${currentBalance.tier}". Use support for downgrades.`,
        );
      }

      // Placeholder: in production, this creates a Stripe Checkout session
      // and returns the session URL. For now, return the plan details and
      // a flag indicating Stripe integration is pending.
      res.json({
        status: "pending_stripe_integration",
        message: "Credit purchase will be available once Stripe billing is connected.",
        requestedTier: targetPlan.tier,
        monthlyCredits: targetPlan.isUnlimited ? "unlimited" : targetPlan.monthlyCredits,
        priceUsd: targetPlan.priceUsd,
        currentTier: currentBalance.tier,
        // TODO: Replace with Stripe Checkout URL
        // checkoutUrl: await createStripeCheckout(tenantId, tier),
      });
    } catch (error) {
      next(error);
    }
  },
);

// ── GET /api/v1/credits/plans ──
// List all available plans for comparison.

router.get(
  "/plans",
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const plans = Object.values(PLAN_CONFIGS).map((plan) => ({
        tier: plan.tier,
        monthlyCredits: plan.isUnlimited ? "unlimited" : plan.monthlyCredits,
        priceUsd: plan.priceUsd,
        isUnlimited: plan.isUnlimited,
      }));

      res.json({ plans });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
