/**
 * 60-Day Medicare Frequency Calculator — Pure Calculation Logic
 *
 * All functions are deterministic, pure TypeScript — no DOM, no React, no API calls.
 * Suitable for unit testing and offline use.
 */

import {
  addDays,
  startOfDay,
  differenceInCalendarDays,
  nextSaturday,
  isSaturday,
  isValid,
  parseISO,
} from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeekInfo {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  daysInWeek: number;
  dayStart: number;
  dayEnd: number;
}

export interface EpisodeDetails {
  startDate: Date;
  endDate: Date;
  weeks: WeekInfo[];
}

export interface ParsedFrequency {
  visits: number[];
  totalVisits: number;
  valid: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Episode calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the week structure for a 60-day Medicare episode.
 *
 * Medicare episodes are 60 days (Day 1 = SOC, Day 60 = SOC + 59).
 * Weeks run Sunday–Saturday. Week 1 starts on SOC date and ends on the
 * following Saturday (or SOC itself if SOC falls on Saturday).
 * The final week may be partial, ending on Day 60.
 */
export function calculateEpisodeDetails(socDateStr: string): EpisodeDetails | null {
  const parsed = parseISO(socDateStr);
  if (!isValid(parsed)) return null;

  const soc = startOfDay(parsed);
  const endDate = addDays(soc, 59);
  const weeks: WeekInfo[] = [];

  let current = soc;
  let weekNum = 1;

  while (current <= endDate) {
    let weekEnd: Date;
    if (isSaturday(current)) {
      weekEnd = current;
    } else {
      weekEnd = nextSaturday(current);
    }
    if (weekEnd > endDate) {
      weekEnd = endDate;
    }

    const dayStart = differenceInCalendarDays(current, soc) + 1;
    const dayEnd = differenceInCalendarDays(weekEnd, soc) + 1;
    const daysInWeek = dayEnd - dayStart + 1;

    weeks.push({
      weekNumber: weekNum,
      startDate: current,
      endDate: weekEnd,
      daysInWeek,
      dayStart,
      dayEnd,
    });

    current = addDays(weekEnd, 1);
    weekNum++;
  }

  return { startDate: soc, endDate, weeks };
}

// ---------------------------------------------------------------------------
// Frequency string parsing
// ---------------------------------------------------------------------------

/**
 * Parse a frequency notation string like "3W2 2W2 1W4" or "3W2, 2W2, 1W4"
 * into a per-week visit array.
 *
 * Supported formats:
 * - "3W2" = 3 visits/week for 2 weeks
 * - "3W2 2W2 1W4" = space-separated segments
 * - "3W2, 2W2, 1W4" = comma-separated segments
 * - "3w2;2w2;1w4" = semicolon-separated, case-insensitive
 */
export function parseFrequencyString(input: string, weekCount: number): ParsedFrequency {
  const cleaned = input.trim();
  if (!cleaned) {
    return { visits: Array(weekCount).fill(0), totalVisits: 0, valid: false, error: "Enter a frequency" };
  }

  // Split on commas, semicolons, or whitespace
  const segments = cleaned.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  const visits: number[] = [];

  for (const seg of segments) {
    const match = seg.match(/^(\d+)\s*[wW]\s*(\d+)$/);
    if (!match) {
      return {
        visits: Array(weekCount).fill(0),
        totalVisits: 0,
        valid: false,
        error: `Invalid segment: "${seg}". Use format like 3W2`,
      };
    }
    const perWeek = parseInt(match[1], 10);
    const weeks = parseInt(match[2], 10);
    if (weeks < 1) {
      return {
        visits: Array(weekCount).fill(0),
        totalVisits: 0,
        valid: false,
        error: `Week count must be at least 1 in "${seg}"`,
      };
    }
    for (let i = 0; i < weeks; i++) {
      visits.push(perWeek);
    }
  }

  const result = Array(weekCount).fill(0);
  for (let i = 0; i < Math.min(visits.length, weekCount); i++) {
    result[i] = visits[i];
  }
  const total = result.reduce((a: number, b: number) => a + b, 0);

  if (visits.length > weekCount) {
    return {
      visits: result,
      totalVisits: total,
      valid: true,
      error: `Frequency covers ${visits.length} weeks but episode has ${weekCount} — truncated`,
    };
  }

  return { visits: result, totalVisits: total, valid: true };
}

// ---------------------------------------------------------------------------
// Frequency string generation (from visit counts)
// ---------------------------------------------------------------------------

/**
 * Generate a compact frequency notation from per-week visit counts.
 * e.g., [3, 3, 2, 2, 1, 1, 1, 1] -> "3w2, 2w2, 1w4"
 */
export function generateFrequencyString(visitsArray: number[]): string {
  const parts: string[] = [];
  let currentVisits = visitsArray[0];
  let count = 1;

  for (let i = 1; i < visitsArray.length; i++) {
    if (visitsArray[i] === currentVisits && visitsArray[i] > 0) {
      count++;
    } else {
      if (currentVisits > 0) {
        parts.push(`${currentVisits}w${count}`);
      }
      currentVisits = visitsArray[i];
      count = 1;
    }
  }
  if (currentVisits > 0) {
    parts.push(`${currentVisits}w${count}`);
  }

  return parts.join(", ") || "No visits prescribed";
}

// ---------------------------------------------------------------------------
// Period calculations
// ---------------------------------------------------------------------------

/**
 * Calculate visits in PDGM Period 1 (Days 1-30) and Period 2 (Days 31-60).
 */
export function calculatePeriodVisits(
  weeks: WeekInfo[],
  visits: number[]
): { period1: number; period2: number } {
  let period1 = 0;
  let period2 = 0;

  for (let i = 0; i < weeks.length; i++) {
    const weekVisits = visits[i] || 0;
    if (weeks[i].dayEnd <= 30) {
      period1 += weekVisits;
    } else if (weeks[i].dayStart > 30) {
      period2 += weekVisits;
    } else {
      // Week straddles the period boundary
      const daysInPeriod1 = 30 - weeks[i].dayStart + 1;
      const totalDaysInWeek = weeks[i].dayEnd - weeks[i].dayStart + 1;
      const ratio = daysInPeriod1 / totalDaysInWeek;
      const p1Visits = Math.round(weekVisits * ratio);
      period1 += p1Visits;
      period2 += weekVisits - p1Visits;
    }
  }

  return { period1, period2 };
}

// ---------------------------------------------------------------------------
// Compliance checks
// ---------------------------------------------------------------------------

export type ComplianceLevel = "compliant" | "warning" | "at_risk";

export interface ComplianceResult {
  level: ComplianceLevel;
  totalVisits: number;
  period1Visits: number;
  period2Visits: number;
  frontLoadingRatio: number;
  lupaRisk: "low" | "medium" | "high";
  issues: string[];
  episodeDays: number;
}

/**
 * Run a basic compliance check on a visit schedule against the 60-day episode.
 * This is a deterministic check (no LLM).
 *
 * LUPA thresholds per CMS: varies by PDGM group, but the general minimum
 * is 2 visits per 30-day period. Below that threshold, the agency receives
 * a per-visit payment instead of the full PDGM case-mix adjusted amount.
 */
export function checkCompliance(
  weeks: WeekInfo[],
  visits: number[],
  lupaThreshold: number = 2
): ComplianceResult {
  const { period1, period2 } = calculatePeriodVisits(weeks, visits);
  const totalVisits = visits.reduce((a, b) => a + b, 0);
  const issues: string[] = [];

  // LUPA risk
  let lupaRisk: "low" | "medium" | "high" = "low";
  if (period1 < lupaThreshold) {
    lupaRisk = "high";
    issues.push(`Period 1 has ${period1} visit(s) — below LUPA threshold of ${lupaThreshold}`);
  }
  if (period2 < lupaThreshold && totalVisits > 0) {
    if (lupaRisk !== "high") lupaRisk = "medium";
    issues.push(`Period 2 has ${period2} visit(s) — below LUPA threshold of ${lupaThreshold}`);
  }

  // Front-loading ratio
  const frontLoadingRatio = totalVisits > 0 ? period1 / totalVisits : 0;
  if (totalVisits > 0 && frontLoadingRatio < 0.5) {
    issues.push("Schedule is back-loaded — PDGM incentivizes front-loading visits in Period 1");
  }

  // Extreme front-loading
  if (totalVisits > 0 && period2 === 0) {
    issues.push("No visits scheduled in Period 2 — may trigger audit review");
  }

  // Overall level
  let level: ComplianceLevel = "compliant";
  if (lupaRisk === "high" || issues.length >= 2) {
    level = "at_risk";
  } else if (issues.length >= 1) {
    level = "warning";
  }

  return {
    level,
    totalVisits,
    period1Visits: period1,
    period2Visits: period2,
    frontLoadingRatio,
    lupaRisk,
    issues,
    episodeDays: 60,
  };
}
