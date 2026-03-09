import { addDays, format, isWithinInterval, startOfDay, differenceInCalendarDays, nextSaturday, isSaturday } from "date-fns";

export interface WeekDetail {
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
  weeks: WeekDetail[];
}

export function calculateEpisode(socDate: Date): EpisodeDetails {
  const soc = startOfDay(socDate);
  const endDate = addDays(soc, 59);
  const weeks: WeekDetail[] = [];

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

export function calculateFrequencyStr(visitsArray: number[]): string {
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

export function deriveVisitsFromDates(
  selectedDates: Date[],
  episode: EpisodeDetails
): number[] {
  const counts = Array(episode.weeks.length).fill(0);
  selectedDates.forEach((date) => {
    const normalizedDate = startOfDay(date);
    for (let i = 0; i < episode.weeks.length; i++) {
      const week = episode.weeks[i];
      if (
        isWithinInterval(normalizedDate, {
          start: startOfDay(week.startDate),
          end: startOfDay(week.endDate),
        })
      ) {
        counts[i]++;
        break;
      }
    }
  });
  return counts;
}

export interface ParsedFrequency {
  visits: number[];
  totalVisits: number;
  valid: boolean;
  error?: string;
}

export function parseFrequencyStr(input: string, weekCount: number): ParsedFrequency {
  const cleaned = input.trim();
  if (!cleaned) return { visits: Array(weekCount).fill(0), totalVisits: 0, valid: false, error: "Enter a frequency" };

  const segments = cleaned.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  const visits: number[] = [];

  for (const seg of segments) {
    const match = seg.match(/^(\d+)\s*[wW]\s*(\d+)$/);
    if (!match) return { visits: Array(weekCount).fill(0), totalVisits: 0, valid: false, error: `Invalid segment: "${seg}". Use format like 3W2` };
    const perWeek = parseInt(match[1], 10);
    const weeks = parseInt(match[2], 10);
    if (weeks < 1) return { visits: Array(weekCount).fill(0), totalVisits: 0, valid: false, error: `Week count must be at least 1 in "${seg}"` };
    for (let i = 0; i < weeks; i++) visits.push(perWeek);
  }

  const result = Array(weekCount).fill(0);
  for (let i = 0; i < Math.min(visits.length, weekCount); i++) result[i] = visits[i];
  const total = result.reduce((a: number, b: number) => a + b, 0);

  if (visits.length > weekCount) {
    return { visits: result, totalVisits: total, valid: true, error: `Frequency covers ${visits.length} weeks but episode has ${weekCount} — truncated` };
  }

  return { visits: result, totalVisits: total, valid: true };
}

export function isDateInEpisode(date: Date, episode: EpisodeDetails): boolean {
  const normDate = startOfDay(date);
  return (
    normDate >= startOfDay(episode.startDate) &&
    normDate <= startOfDay(episode.endDate)
  );
}
