import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: assessmentsData } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => apiRequest("/api/assessments"),
  });

  const { data: statsData } = useQuery({
    queryKey: ["remediation-stats"],
    queryFn: () => apiRequest("/api/remediation/dashboard"),
  });

  const assessments = assessmentsData?.assessments || [];
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad the start to align with weekday
  const startDay = monthStart.getDay();
  const paddedDays = Array(startDay).fill(null).concat(days);

  // Events: assessment created dates and remediation due dates
  const events: Array<{ date: Date; label: string; type: string }> = [];
  for (const a of assessments) {
    if (a.createdAt) {
      events.push({ date: new Date(a.createdAt), label: a.title, type: "assessment" });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Compliance Calendar</h1>

      <div className="bg-card rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-muted rounded-lg transition">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-muted rounded-lg transition">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {paddedDays.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} />;
            const dayEvents = events.filter(e => isSameDay(e.date, day));
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[60px] p-1 rounded-md text-sm",
                  isToday ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50",
                )}
              >
                <span className={cn("text-xs", isToday ? "font-bold text-primary" : "text-muted-foreground")}>
                  {format(day, "d")}
                </span>
                {dayEvents.slice(0, 2).map((e, j) => (
                  <div key={j} className={cn(
                    "text-[10px] truncate px-1 rounded mt-0.5",
                    e.type === "assessment" ? "bg-primary/10 text-primary" : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
                  )}>
                    {e.label}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary/20" />
          Assessment
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-orange-200 dark:bg-orange-900/30" />
          Remediation Due
        </div>
      </div>
    </div>
  );
}
