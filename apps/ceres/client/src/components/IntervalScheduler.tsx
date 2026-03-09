import { useState, useMemo } from "react";
import {
  eachDayOfInterval,
  getDay,
  addDays,
  format,
  startOfDay,
  isWithinInterval,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarClock, Check } from "lucide-react";

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

interface IntervalSchedulerProps {
  episodeDetails: EpisodeDetails | null;
  onApply: (visits: number[], dates: Date[]) => void;
}

const WEEKDAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

export default function IntervalScheduler({ episodeDetails, onApply }: IntervalSchedulerProps) {
  const [mode, setMode] = useState<"every-n-days" | "specific-weekdays">("every-n-days");
  const [intervalDays, setIntervalDays] = useState(3);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);

  const computedDates = useMemo(() => {
    if (!episodeDetails) return [];
    const start = startOfDay(episodeDetails.startDate);
    const end = startOfDay(episodeDetails.endDate);

    if (mode === "every-n-days") {
      if (intervalDays < 1) return [];
      const dates: Date[] = [];
      let current = start;
      while (current <= end) {
        dates.push(current);
        current = addDays(current, intervalDays);
      }
      return dates;
    }

    if (selectedWeekdays.length === 0) return [];
    const allDays = eachDayOfInterval({ start, end });
    return allDays.filter((d) => selectedWeekdays.includes(getDay(d)));
  }, [episodeDetails, mode, intervalDays, selectedWeekdays]);

  const perWeekVisits = useMemo(() => {
    if (!episodeDetails) return [];
    const counts = Array(episodeDetails.weeks.length).fill(0);
    computedDates.forEach((date) => {
      const normDate = startOfDay(date);
      for (let i = 0; i < episodeDetails.weeks.length; i++) {
        const week = episodeDetails.weeks[i];
        if (
          isWithinInterval(normDate, {
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
  }, [episodeDetails, computedDates]);

  const toggleWeekday = (day: number) => {
    setSelectedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleApply = () => {
    onApply(perWeekVisits, computedDates);
  };

  if (!episodeDetails) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Enter a SOC date to use the interval scheduler.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <CalendarClock className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Interval Scheduler</h3>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Scheduling Mode</Label>
        <div className="flex gap-2">
          <Button
            data-testid="button-mode-every-n-days"
            variant={mode === "every-n-days" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("every-n-days")}
          >
            Every N Days
          </Button>
          <Button
            data-testid="button-mode-specific-weekdays"
            variant={mode === "specific-weekdays" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("specific-weekdays")}
          >
            Specific Weekdays
          </Button>
        </div>
      </div>

      {mode === "every-n-days" && (
        <div className="space-y-2">
          <Label htmlFor="interval-days" className="text-sm font-semibold">
            Visit every N days
          </Label>
          <Input
            id="interval-days"
            data-testid="input-interval-days"
            type="number"
            min={1}
            max={60}
            value={intervalDays}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              setIntervalDays(isNaN(v) ? 1 : Math.max(1, Math.min(60, v)));
            }}
            className="h-12 w-32 bg-muted/30 focus-visible:ring-primary font-mono text-lg"
          />
          <p className="text-xs text-muted-foreground">
            Starting from {format(episodeDetails.startDate, "MMM d, yyyy")}, a visit is scheduled every {intervalDays} day{intervalDays !== 1 ? "s" : ""}.
          </p>
        </div>
      )}

      {mode === "specific-weekdays" && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Select Days of the Week</Label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((wd) => (
              <button
                key={wd.value}
                data-testid={`checkbox-weekday-${wd.label.toLowerCase()}`}
                onClick={() => toggleWeekday(wd.value)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  selectedWeekdays.includes(wd.value)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/30 text-foreground border-border hover:bg-muted/50"
                }`}
              >
                {wd.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-muted/30 rounded-lg p-4 border border-border/50 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">Preview</div>
          <div className="text-sm text-muted-foreground">
            Total Visits: <span data-testid="text-interval-total" className="font-bold text-foreground">{computedDates.length}</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Per-Week Distribution
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {perWeekVisits.map((count, i) => (
              <div
                key={i}
                data-testid={`text-week-visits-${i}`}
                className="flex flex-col items-center bg-background rounded-lg border border-border/50 p-2"
              >
                <span className="text-[10px] text-muted-foreground font-medium">W{i + 1}</span>
                <span className="text-sm font-bold text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {computedDates.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Scheduled Dates
            </div>
            <div className="max-h-40 overflow-y-auto">
              <div className="flex flex-wrap gap-1.5">
                {computedDates.map((date, i) => (
                  <span
                    key={i}
                    data-testid={`text-scheduled-date-${i}`}
                    className="text-xs bg-background border border-border/50 rounded px-2 py-1 font-mono text-foreground"
                  >
                    {format(date, "MMM d")}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <Button
        data-testid="button-apply-interval"
        onClick={handleApply}
        disabled={computedDates.length === 0}
        className="w-full h-12 font-semibold"
      >
        <Check className="w-4 h-4 mr-2" />
        Apply {computedDates.length} Visit{computedDates.length !== 1 ? "s" : ""}
      </Button>
    </div>
  );
}
