import { useState, useMemo } from "react";
import { format, differenceInCalendarDays, addDays, startOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

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

interface TimelineProps {
  episodeDetails: EpisodeDetails | null;
  visits: number[];
  visitDates?: Date[];
}

function getWeekColor(visitCount: number): string {
  if (visitCount === 0) return "bg-muted";
  if (visitCount <= 2) return "bg-primary/30";
  if (visitCount <= 4) return "bg-primary/60";
  return "bg-primary";
}

function getWeekBorderColor(visitCount: number): string {
  if (visitCount === 0) return "border-muted-foreground/20";
  if (visitCount <= 2) return "border-primary/40";
  if (visitCount <= 4) return "border-primary/70";
  return "border-primary";
}

export default function Timeline({ episodeDetails, visits, visitDates }: TimelineProps) {
  const [isOpen, setIsOpen] = useState(true);

  const totalDays = 60;

  const dayPositions = useMemo(() => {
    if (!episodeDetails) return [];
    const positions: { day: number; left: string; date: Date; label: string }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const date = addDays(startOfDay(episodeDetails.startDate), i);
      positions.push({
        day: i + 1,
        left: `${(i / (totalDays - 1)) * 100}%`,
        date,
        label: `Day ${i + 1} - ${format(date, "EEE, MMM d")}`,
      });
    }
    return positions;
  }, [episodeDetails]);

  const visitDotPositions = useMemo(() => {
    if (!episodeDetails || !visitDates || visitDates.length === 0) return [];
    return visitDates
      .map((d) => {
        const dayIndex = differenceInCalendarDays(startOfDay(d), startOfDay(episodeDetails.startDate));
        if (dayIndex < 0 || dayIndex >= totalDays) return null;
        return {
          day: dayIndex + 1,
          left: `${(dayIndex / (totalDays - 1)) * 100}%`,
          date: d,
        };
      })
      .filter(Boolean) as { day: number; left: string; date: Date }[];
  }, [episodeDetails, visitDates]);

  if (!episodeDetails) return null;

  const period1EndDay = 30;
  const periodDividerLeft = `${((period1EndDay - 0.5) / totalDays) * 100}%`;

  return (
    <Card className="border-none shadow-md" data-testid="timeline-container">
      <CardHeader className="cursor-pointer select-none" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">Timeline</CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8" tabIndex={-1}>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="pt-0 pb-6 px-6">
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground font-medium">
              <span>SOC</span>
              <span>Day 60</span>
            </div>

            <div className="relative h-20">
              <div className="absolute inset-x-0 top-8 h-6 bg-muted/40 rounded-sm border border-border/50" />

              {episodeDetails.weeks.map((week, i) => {
                const weekLeft = ((week.dayStart - 1) / totalDays) * 100;
                const weekWidth = (week.daysInWeek / totalDays) * 100;
                const visitCount = visits[i] ?? 0;

                return (
                  <div key={week.weekNumber}>
                    <div
                      className="absolute text-[10px] text-muted-foreground font-medium text-center"
                      style={{
                        left: `${weekLeft}%`,
                        width: `${weekWidth}%`,
                        top: 0,
                      }}
                    >
                      W{week.weekNumber}
                    </div>

                    {visitDates && visitDates.length > 0 ? null : (
                      <div
                        className={`absolute top-8 h-6 rounded-sm ${getWeekColor(visitCount)} transition-colors`}
                        style={{
                          left: `${weekLeft}%`,
                          width: `${weekWidth}%`,
                        }}
                      />
                    )}

                    {i > 0 && (
                      <div
                        className="absolute top-3 w-px bg-border/60"
                        style={{
                          left: `${weekLeft}%`,
                          height: "calc(100% - 12px)",
                        }}
                      />
                    )}
                  </div>
                );
              })}

              <div
                className="absolute top-2 border-l-2 border-dashed border-orange-500/70 z-10"
                style={{
                  left: periodDividerLeft,
                  height: "calc(100% - 4px)",
                }}
              />
              <div
                className="absolute text-[9px] font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap z-10"
                style={{
                  left: periodDividerLeft,
                  bottom: -2,
                  transform: "translateX(-50%)",
                }}
              >
                P1 | P2
              </div>

              {visitDates && visitDates.length > 0 &&
                visitDotPositions.map((dot, idx) => (
                  <div
                    key={idx}
                    className="absolute top-9 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background z-20 -translate-x-1/2 hover:scale-150 transition-transform"
                    style={{ left: dot.left }}
                    title={`Day ${dot.day} - ${format(dot.date, "EEE, MMM d")}`}
                  />
                ))}

              {dayPositions.map((pos) => (
                <div
                  key={pos.day}
                  className="absolute top-8 h-6 z-30 cursor-crosshair group"
                  style={{
                    left: pos.left,
                    width: `${100 / totalDays}%`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow-md border border-border whitespace-nowrap z-50">
                    {pos.label}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="w-3 h-3 rounded-sm bg-muted border border-muted-foreground/20" />
                <span>0 visits</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="w-3 h-3 rounded-sm bg-primary/30" />
                <span>1–2</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="w-3 h-3 rounded-sm bg-primary/60" />
                <span>3–4</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="w-3 h-3 rounded-sm bg-primary" />
                <span>5+</span>
              </div>
              <div className="ml-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="w-px h-3 border-l-2 border-dashed border-orange-500/70" />
                <span>PDGM 30-day split</span>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
