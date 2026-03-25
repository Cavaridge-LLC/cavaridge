import { describe, it, expect } from "vitest";
import {
  calculateEpisodeDetails,
  parseFrequencyString,
  generateFrequencyString,
  calculatePeriodVisits,
  checkCompliance,
} from "./frequency";
import { differenceInCalendarDays, getDay } from "date-fns";

// ---------------------------------------------------------------------------
// calculateEpisodeDetails
// ---------------------------------------------------------------------------

describe("calculateEpisodeDetails", () => {
  it("returns null for invalid date", () => {
    expect(calculateEpisodeDetails("not-a-date")).toBeNull();
    expect(calculateEpisodeDetails("")).toBeNull();
  });

  it("creates a 60-day episode (Day 1 = SOC, Day 60 = SOC + 59)", () => {
    const ep = calculateEpisodeDetails("2026-03-10");
    expect(ep).not.toBeNull();
    if (!ep) return;

    const dayCount = differenceInCalendarDays(ep.endDate, ep.startDate) + 1;
    expect(dayCount).toBe(60);
  });

  it("weeks run Sunday–Saturday boundaries", () => {
    // 2026-03-10 is a Tuesday
    const ep = calculateEpisodeDetails("2026-03-10");
    if (!ep) throw new Error("null");

    // Week 1 starts on SOC (Tuesday) and ends on Saturday
    expect(getDay(ep.weeks[0].startDate)).toBe(2); // Tuesday
    expect(getDay(ep.weeks[0].endDate)).toBe(6); // Saturday

    // Middle weeks should be full Sun–Sat
    expect(ep.weeks[1].daysInWeek).toBe(7);
    expect(getDay(ep.weeks[1].startDate)).toBe(0); // Sunday
    expect(getDay(ep.weeks[1].endDate)).toBe(6); // Saturday
  });

  it("SOC on Saturday produces a 1-day first week", () => {
    // 2026-03-14 is a Saturday
    const ep = calculateEpisodeDetails("2026-03-14");
    if (!ep) throw new Error("null");

    expect(ep.weeks[0].daysInWeek).toBe(1);
    expect(getDay(ep.weeks[0].startDate)).toBe(6);
    expect(getDay(ep.weeks[0].endDate)).toBe(6);
  });

  it("SOC on Sunday produces a full 7-day first week", () => {
    // 2026-03-15 is a Sunday
    const ep = calculateEpisodeDetails("2026-03-15");
    if (!ep) throw new Error("null");

    expect(ep.weeks[0].daysInWeek).toBe(7);
    expect(getDay(ep.weeks[0].startDate)).toBe(0);
  });

  it("total days covered by all weeks = 60", () => {
    const testDates = ["2026-01-01", "2026-03-10", "2026-06-15", "2026-12-25"];
    for (const d of testDates) {
      const ep = calculateEpisodeDetails(d);
      if (!ep) throw new Error("null");
      const totalDays = ep.weeks.reduce((acc, w) => acc + w.daysInWeek, 0);
      expect(totalDays).toBe(60);
    }
  });

  it("produces 9-10 weeks depending on SOC day", () => {
    // Sunday SOC = 9 weeks (7+7+7+7+7+7+7+7+4 = 60... actually depends on exact date)
    const testDates = ["2026-01-01", "2026-03-10", "2026-03-14", "2026-03-15"];
    for (const d of testDates) {
      const ep = calculateEpisodeDetails(d);
      if (!ep) throw new Error("null");
      expect(ep.weeks.length).toBeGreaterThanOrEqual(9);
      expect(ep.weeks.length).toBeLessThanOrEqual(10);
    }
  });

  it("week dayStart and dayEnd are contiguous", () => {
    const ep = calculateEpisodeDetails("2026-04-01");
    if (!ep) throw new Error("null");

    for (let i = 1; i < ep.weeks.length; i++) {
      expect(ep.weeks[i].dayStart).toBe(ep.weeks[i - 1].dayEnd + 1);
    }
    expect(ep.weeks[0].dayStart).toBe(1);
    expect(ep.weeks[ep.weeks.length - 1].dayEnd).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// parseFrequencyString
// ---------------------------------------------------------------------------

describe("parseFrequencyString", () => {
  it("parses simple frequency: 3W2", () => {
    const result = parseFrequencyString("3W2", 10);
    expect(result.valid).toBe(true);
    expect(result.visits.slice(0, 2)).toEqual([3, 3]);
    expect(result.totalVisits).toBe(6);
  });

  it("parses compound frequency: 3W2 2W2 1W4", () => {
    const result = parseFrequencyString("3W2 2W2 1W4", 10);
    expect(result.valid).toBe(true);
    expect(result.visits).toEqual([3, 3, 2, 2, 1, 1, 1, 1, 0, 0]);
    expect(result.totalVisits).toBe(14);
  });

  it("parses comma-separated: 3W2, 2W2, 1W4", () => {
    const result = parseFrequencyString("3W2, 2W2, 1W4", 10);
    expect(result.valid).toBe(true);
    expect(result.totalVisits).toBe(14);
  });

  it("parses semicolon-separated: 3W2;2W2;1W4", () => {
    const result = parseFrequencyString("3W2;2W2;1W4", 10);
    expect(result.valid).toBe(true);
    expect(result.totalVisits).toBe(14);
  });

  it("case insensitive: 3w2 2w2 1w4", () => {
    const result = parseFrequencyString("3w2 2w2 1w4", 10);
    expect(result.valid).toBe(true);
    expect(result.totalVisits).toBe(14);
  });

  it("truncates when frequency exceeds week count", () => {
    const result = parseFrequencyString("3W5 2W5 1W5", 10);
    expect(result.valid).toBe(true);
    expect(result.visits.length).toBe(10);
    expect(result.error).toContain("truncated");
  });

  it("returns error for invalid segment", () => {
    const result = parseFrequencyString("hello", 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid segment");
  });

  it("returns error for empty input", () => {
    const result = parseFrequencyString("", 10);
    expect(result.valid).toBe(false);
  });

  it("returns error for 0-week segment", () => {
    const result = parseFrequencyString("3W0", 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("at least 1");
  });

  it("handles single visit per week for full episode: 1W9", () => {
    const result = parseFrequencyString("1W9", 9);
    expect(result.valid).toBe(true);
    expect(result.totalVisits).toBe(9);
    expect(result.visits.every((v) => v === 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateFrequencyString
// ---------------------------------------------------------------------------

describe("generateFrequencyString", () => {
  it("generates compact notation from visit array", () => {
    expect(generateFrequencyString([3, 3, 2, 2, 1, 1, 1, 1])).toBe("3w2, 2w2, 1w4");
  });

  it("handles single segment", () => {
    expect(generateFrequencyString([2, 2, 2, 2, 2])).toBe("2w5");
  });

  it("returns 'No visits prescribed' for all zeros", () => {
    expect(generateFrequencyString([0, 0, 0, 0])).toBe("No visits prescribed");
  });

  it("skips zero-visit gaps", () => {
    expect(generateFrequencyString([3, 3, 0, 0, 1, 1])).toBe("3w2, 1w2");
  });

  it("handles mixed pattern", () => {
    expect(generateFrequencyString([5, 3, 3, 2, 1])).toBe("5w1, 3w2, 2w1, 1w1");
  });
});

// ---------------------------------------------------------------------------
// calculatePeriodVisits
// ---------------------------------------------------------------------------

describe("calculatePeriodVisits", () => {
  it("splits visits between Period 1 (days 1-30) and Period 2 (days 31-60)", () => {
    const ep = calculateEpisodeDetails("2026-03-15"); // Sunday
    if (!ep) throw new Error("null");

    // All visits in first 4 weeks (should be entirely in Period 1 for Sunday start)
    const visits = Array(ep.weeks.length).fill(0);
    visits[0] = 3;
    visits[1] = 3;
    visits[2] = 2;
    visits[3] = 2;

    const { period1, period2 } = calculatePeriodVisits(ep.weeks, visits);
    expect(period1).toBeGreaterThan(0);
    expect(period1 + period2).toBe(10);
  });

  it("returns 0 for both periods when no visits", () => {
    const ep = calculateEpisodeDetails("2026-03-10");
    if (!ep) throw new Error("null");
    const visits = Array(ep.weeks.length).fill(0);
    const { period1, period2 } = calculatePeriodVisits(ep.weeks, visits);
    expect(period1).toBe(0);
    expect(period2).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// checkCompliance
// ---------------------------------------------------------------------------

describe("checkCompliance", () => {
  it("flags LUPA risk when period 1 has fewer than threshold visits", () => {
    const ep = calculateEpisodeDetails("2026-03-15");
    if (!ep) throw new Error("null");

    // Put 1 visit in first week only
    const visits = Array(ep.weeks.length).fill(0);
    visits[0] = 1;

    const result = checkCompliance(ep.weeks, visits, 2);
    expect(result.lupaRisk).toBe("high");
    expect(result.level).toBe("at_risk");
    expect(result.issues.some((i) => i.includes("LUPA"))).toBe(true);
  });

  it("reports compliant for well-distributed visits", () => {
    const ep = calculateEpisodeDetails("2026-03-15");
    if (!ep) throw new Error("null");

    const visits = Array(ep.weeks.length).fill(2);
    const result = checkCompliance(ep.weeks, visits, 2);
    expect(result.lupaRisk).toBe("low");
    expect(result.level).toBe("compliant");
  });

  it("warns about back-loaded schedules", () => {
    const ep = calculateEpisodeDetails("2026-03-15");
    if (!ep) throw new Error("null");

    // Put all visits in last 4 weeks
    const visits = Array(ep.weeks.length).fill(0);
    const lastIdx = visits.length - 1;
    visits[lastIdx] = 5;
    visits[lastIdx - 1] = 5;
    visits[lastIdx - 2] = 5;
    visits[lastIdx - 3] = 5;

    const result = checkCompliance(ep.weeks, visits);
    expect(result.issues.some((i) => i.includes("back-loaded"))).toBe(true);
  });

  it("warns when no visits in Period 2", () => {
    const ep = calculateEpisodeDetails("2026-03-15");
    if (!ep) throw new Error("null");

    const visits = Array(ep.weeks.length).fill(0);
    visits[0] = 5;
    visits[1] = 5;
    visits[2] = 5;

    const result = checkCompliance(ep.weeks, visits);
    expect(result.issues.some((i) => i.includes("Period 2"))).toBe(true);
  });
});
