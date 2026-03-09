import { format, differenceInCalendarDays, isWithinInterval, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Download, Calendar } from "lucide-react";

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

interface CalendarExportProps {
  dates: Date[];
  episodeDetails: EpisodeDetails | null;
  frequencyStr: string;
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function generateIcs(dates: Date[], frequencyStr: string): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ceres//Home Health Visit Scheduler//EN",
  ];

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());

  sorted.forEach((date, i) => {
    const d = startOfDay(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const dtStart = `${year}${pad(month)}${pad(day)}T090000`;
    const dtEnd = `${year}${pad(month)}${pad(day)}T093000`;
    const stamp = format(new Date(), "yyyyMMdd'T'HHmmss");

    lines.push("BEGIN:VEVENT");
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`UID:ceres-visit-${i}-${dtStart}@ceres`);
    lines.push(`SUMMARY:Home Health Visit`);
    lines.push(`DESCRIPTION:Frequency: ${frequencyStr}`);
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function generateCsv(dates: Date[], episodeDetails: EpisodeDetails | null): string {
  const rows: string[] = ["Date,Day of Week,Week Number,Day of Episode"];

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());

  sorted.forEach((date) => {
    const d = startOfDay(date);
    const dateStr = format(d, "yyyy-MM-dd");
    const dayOfWeek = format(d, "EEEE");

    let weekNumber = "";
    let dayOfEpisode = "";

    if (episodeDetails) {
      dayOfEpisode = String(differenceInCalendarDays(d, startOfDay(episodeDetails.startDate)) + 1);

      for (const week of episodeDetails.weeks) {
        if (isWithinInterval(d, { start: startOfDay(week.startDate), end: startOfDay(week.endDate) })) {
          weekNumber = String(week.weekNumber);
          break;
        }
      }
    }

    rows.push(`${dateStr},${dayOfWeek},${weekNumber},${dayOfEpisode}`);
  });

  return rows.join("\n");
}

export default function CalendarExport({ dates, episodeDetails, frequencyStr }: CalendarExportProps) {
  const handleExportIcs = () => {
    const content = generateIcs(dates, frequencyStr);
    triggerDownload(content, "home-health-visits.ics", "text/calendar");
  };

  const handleExportCsv = () => {
    const content = generateCsv(dates, episodeDetails);
    triggerDownload(content, "home-health-visits.csv", "text/csv");
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        data-testid="button-export-ics"
        variant="outline"
        size="sm"
        onClick={handleExportIcs}
        disabled={dates.length === 0}
      >
        <Calendar className="w-4 h-4 mr-2" />
        Export .ics
      </Button>
      <Button
        data-testid="button-export-csv"
        variant="outline"
        size="sm"
        onClick={handleExportCsv}
        disabled={dates.length === 0}
      >
        <Download className="w-4 h-4 mr-2" />
        Export CSV
      </Button>
    </div>
  );
}
