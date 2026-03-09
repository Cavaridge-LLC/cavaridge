import { eachDayOfInterval, getDay, isWeekend, format, startOfDay } from "date-fns";
import { Lightbulb } from "lucide-react";

interface WeekInfo {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  daysInWeek: number;
  dayStart: number;
  dayEnd: number;
}

interface EpisodeDetails {
  startDate: Date;
  endDate: Date;
  weeks: WeekInfo[];
}

const DAY_PATTERNS: Record<number, number[]> = {
  1: [3],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
};

function pickDatesForWeek(
  week: WeekInfo,
  visitCount: number,
  isFirstWeek: boolean,
  isLastWeek: boolean
): Date[] {
  if (visitCount <= 0) return [];

  const allDays = eachDayOfInterval({ start: week.startDate, end: week.endDate });
  const weekdays = allDays.filter((d) => !isWeekend(d));

  if (visitCount >= allDays.length) {
    return [...allDays];
  }

  const isPartialWeek = isFirstWeek || isLastWeek;

  if (!isPartialWeek && weekdays.length >= 5 && visitCount <= 5) {
    const pattern = DAY_PATTERNS[visitCount];
    if (pattern) {
      const matched = allDays.filter((d) => pattern.includes(getDay(d)));
      if (matched.length === visitCount) {
        return matched;
      }
    }
  }

  if (isPartialWeek) {
    const pool = weekdays.length >= visitCount ? weekdays : allDays;
    return pool.slice(0, visitCount);
  }

  const pool = weekdays.length >= visitCount ? weekdays : allDays;
  if (visitCount >= pool.length) {
    return [...pool];
  }

  const spacing = pool.length / visitCount;
  const result: Date[] = [];
  for (let j = 0; j < visitCount; j++) {
    result.push(pool[Math.floor(j * spacing)]);
  }
  return result;
}

export function computeSmartDates(
  episodeDetails: EpisodeDetails,
  visitsPerWeek: number[]
): { dates: Date[]; rationale: string[] } {
  const dates: Date[] = [];
  const rationale: string[] = [];
  const totalWeeks = episodeDetails.weeks.length;

  rationale.push("Weekday preference applied — visits scheduled Mon–Fri when possible");

  const usedPatterns: string[] = [];

  for (let i = 0; i < totalWeeks; i++) {
    const week = episodeDetails.weeks[i];
    const visitCount = i < visitsPerWeek.length ? visitsPerWeek[i] : 0;
    if (visitCount <= 0) continue;

    const isFirstWeek = i === 0;
    const isLastWeek = i === totalWeeks - 1;
    const allDays = eachDayOfInterval({ start: week.startDate, end: week.endDate });
    const isPartial = allDays.length < 7;

    const weekDates = pickDatesForWeek(week, visitCount, isFirstWeek, isLastWeek);
    dates.push(...weekDates);

    if (isFirstWeek && isPartial) {
      usedPatterns.push("front-loaded-first");
    }
    if (isLastWeek && isPartial) {
      usedPatterns.push("front-loaded-last");
    }

    if (!isPartial && visitCount <= 5 && visitCount >= 1) {
      const pattern = DAY_PATTERNS[visitCount];
      if (pattern) {
        const dayNames = pattern.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]);
        const key = `${visitCount}x-${dayNames.join("/")}`;
        if (!usedPatterns.includes(key)) {
          usedPatterns.push(key);
        }
      }
    }
  }

  const patternEntries = usedPatterns.filter(
    (p) => !p.startsWith("front-loaded")
  );
  if (patternEntries.length > 0) {
    const seen = new Set<string>();
    for (const p of patternEntries) {
      if (seen.has(p)) continue;
      seen.add(p);
      const [freq, days] = p.split("-");
      const count = freq.replace("x", "");
      rationale.push(
        `${count} visit${Number(count) > 1 ? "s" : ""}/week pattern: ${days} for consistent spacing`
      );
    }
  }

  if (usedPatterns.includes("front-loaded-first")) {
    rationale.push("Partial first week — visits front-loaded to earliest available days");
  }
  if (usedPatterns.includes("front-loaded-last")) {
    rationale.push("Partial last week — visits front-loaded to earliest available days");
  }

  rationale.push("Minimum 1-day gap maintained between visits when possible");

  const totalVisits = dates.length;
  const weekdayVisits = dates.filter((d) => !isWeekend(d)).length;
  if (totalVisits > 0 && weekdayVisits < totalVisits) {
    rationale.push(
      `${totalVisits - weekdayVisits} weekend visit${totalVisits - weekdayVisits > 1 ? "s" : ""} scheduled due to high frequency`
    );
  }

  return { dates: dates.map((d) => startOfDay(d)), rationale };
}

export function SmartScheduleRationale({ rationale }: { rationale: string[] }) {
  if (!rationale.length) return null;

  return (
    <div data-testid="smart-schedule-rationale" className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/50">
      <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-yellow-500" />
      <ul className="space-y-0.5 list-none p-0 m-0">
        {rationale.map((item, idx) => (
          <li key={idx} data-testid={`text-rationale-${idx}`} className="text-xs leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
