import { View, Text, Pressable } from "react-native";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
} from "date-fns";
import { useState, useMemo, useEffect } from "react";
import { EpisodeDetails, isDateInEpisode } from "@/utils/episode";
import { ThemeColors } from "@/utils/theme";

interface CalendarGridProps {
  episode: EpisodeDetails;
  selectedDates: Date[];
  onToggleDate: (date: Date) => void;
  c: ThemeColors;
}

export function CalendarGrid({
  episode,
  selectedDates,
  onToggleDate,
  c,
}: CalendarGridProps) {
  const [currentMonth, setCurrentMonth] = useState(episode.startDate);

  useEffect(() => {
    setCurrentMonth(episode.startDate);
  }, [episode.startDate.getTime()]);

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const rows: Date[][] = [];
    let day = calStart;
    while (day <= calEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(day);
        day = addDays(day, 1);
      }
      rows.push(week);
    }
    return rows;
  }, [currentMonth]);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        padding: 16,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Pressable
          onPress={() => setCurrentMonth(addMonths(currentMonth, -1))}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: c.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 18, color: c.text }}>‹</Text>
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: "700", color: c.text }}>
          {format(currentMonth, "MMMM yyyy")}
        </Text>
        <Pressable
          onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: c.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 18, color: c.text }}>›</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        {dayNames.map((d) => (
          <View key={d} style={{ flex: 1, alignItems: "center" }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: c.textMuted,
                textTransform: "uppercase",
              }}
            >
              {d}
            </Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: "row" }}>
          {week.map((day, di) => {
            const inMonth = isSameMonth(day, currentMonth);
            const inEpisode = isDateInEpisode(day, episode);
            const isSelected = selectedDates.some((d) => isSameDay(d, day));
            const isDisabled = !inMonth || !inEpisode;

            return (
              <Pressable
                key={di}
                onPress={() => {
                  if (!isDisabled) onToggleDate(day);
                }}
                disabled={isDisabled}
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  margin: 2,
                  borderRadius: 10,
                  backgroundColor: isSelected
                    ? c.primary
                    : "transparent",
                  borderCurve: "continuous",
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: isSelected ? "700" : "400",
                    color: isSelected
                      ? c.primaryForeground
                      : isDisabled
                      ? c.textMuted + "40"
                      : c.text,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {format(day, "d")}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
