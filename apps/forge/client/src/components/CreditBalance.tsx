/**
 * CreditBalance — Displays tenant credit status with progress bar,
 * tier badge, color-coded remaining count, usage breakdown chart,
 * and upgrade CTA for non-enterprise tiers.
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { Coins, TrendingUp, ArrowUpCircle, Loader2 } from "lucide-react";

interface CreditBalanceData {
  balance: {
    totalCredits: number;
    usedCredits: number;
    availableCredits: number | "unlimited";
    tier: string;
    isUnlimited: boolean;
    resetAt: string | null;
  };
  plan: {
    tier: string;
    monthlyCredits: number | "unlimited";
    priceUsd: number;
  };
  usageByContentType: {
    contentType: string;
    totalCredits: number;
    count: number;
  }[];
}

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

const TIER_COLORS: Record<string, string> = {
  free: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  starter: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  professional: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  enterprise: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog_post: "Blog Post",
  white_paper: "Whitepaper",
  case_study: "Case Study",
  social_media_series: "Social Post",
  email_campaign: "Email Sequence",
  proposal: "Presentation",
  one_pager: "Landing Page",
  custom: "Custom",
};

const CHART_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-indigo-500",
];

interface Props {
  /** Optional callback when "Upgrade Plan" is clicked */
  onUpgrade?: () => void;
  /** Compact mode hides usage breakdown chart */
  compact?: boolean;
}

export default function CreditBalance({ onUpgrade, compact = false }: Props) {
  const { data, isLoading, error } = useQuery<CreditBalanceData>({
    queryKey: ["/api/v1/credits"],
    queryFn: () => apiRequest("/api/v1/credits"),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-6 flex items-center justify-center min-h-[120px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-card rounded-xl border p-6">
        <p className="text-sm text-destructive">Unable to load credit balance.</p>
      </div>
    );
  }

  const { balance, plan, usageByContentType } = data;
  const isUnlimited = balance.isUnlimited;
  const available = isUnlimited ? Infinity : (balance.availableCredits as number);
  const total = balance.totalCredits;
  const used = balance.usedCredits;

  // Progress percentage (0-100)
  const progressPct = isUnlimited ? 100 : total > 0 ? ((total - used) / total) * 100 : 0;

  // Color coding: green >50%, yellow >20%, red <=20%
  let progressColor = "bg-emerald-500";
  let textColor = "text-emerald-600 dark:text-emerald-400";
  if (!isUnlimited) {
    if (progressPct <= 20) {
      progressColor = "bg-red-500";
      textColor = "text-red-600 dark:text-red-400";
    } else if (progressPct <= 50) {
      progressColor = "bg-amber-500";
      textColor = "text-amber-600 dark:text-amber-400";
    }
  }

  const tierLabel = TIER_LABELS[balance.tier] ?? balance.tier;
  const tierColor = TIER_COLORS[balance.tier] ?? TIER_COLORS.free;
  const showUpgrade = balance.tier !== "enterprise";

  // Reset date formatting
  const resetLabel = balance.resetAt
    ? new Date(balance.resetAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  // Usage chart data
  const totalUsageCredits = usageByContentType.reduce((sum, u) => sum + u.totalCredits, 0);

  return (
    <div className="bg-card rounded-xl border p-6 space-y-5">
      {/* Header: Balance + Tier */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Coins className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Credit Balance</p>
            <p className={`text-2xl font-bold ${textColor}`}>
              {isUnlimited ? "Unlimited" : available.toLocaleString()}
            </p>
          </div>
        </div>

        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${tierColor}`}>
          {tierLabel}
        </span>
      </div>

      {/* Progress bar */}
      {!isUnlimited && (
        <div className="space-y-2">
          <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${Math.max(progressPct, 1)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{used.toLocaleString()} used of {total.toLocaleString()}</span>
            {resetLabel && <span>Resets {resetLabel}</span>}
          </div>
        </div>
      )}

      {/* Usage breakdown chart (last 30 days) */}
      {!compact && usageByContentType.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Usage (last 30 days)</span>
          </div>

          {/* Stacked bar */}
          {totalUsageCredits > 0 && (
            <div className="h-3 w-full rounded-full overflow-hidden flex">
              {usageByContentType.map((entry, idx) => {
                const pct = (entry.totalCredits / totalUsageCredits) * 100;
                return (
                  <div
                    key={entry.contentType}
                    className={`${CHART_COLORS[idx % CHART_COLORS.length]} transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                    title={`${CONTENT_TYPE_LABELS[entry.contentType] ?? entry.contentType}: ${entry.totalCredits} credits`}
                  />
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {usageByContentType.map((entry, idx) => (
              <div key={entry.contentType} className="flex items-center gap-2 text-xs">
                <div
                  className={`h-2.5 w-2.5 rounded-sm flex-shrink-0 ${CHART_COLORS[idx % CHART_COLORS.length]}`}
                />
                <span className="text-muted-foreground truncate">
                  {CONTENT_TYPE_LABELS[entry.contentType] ?? entry.contentType}
                </span>
                <span className="font-mono text-foreground ml-auto">
                  {entry.totalCredits}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upgrade CTA */}
      {showUpgrade && (
        <button
          onClick={onUpgrade}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-primary/30 rounded-lg text-sm font-medium text-primary hover:bg-primary/5 transition"
        >
          <ArrowUpCircle className="h-4 w-4" />
          Upgrade Plan
        </button>
      )}
    </div>
  );
}
