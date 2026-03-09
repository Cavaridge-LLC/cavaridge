import { View, Text, Pressable } from "react-native";
import { format } from "date-fns";
import { WeekDetail } from "@/utils/episode";
import { ThemeColors } from "@/utils/theme";

interface WeekRowProps {
  week: WeekDetail;
  index: number;
  visits: number;
  onIncrement: () => void;
  onDecrement: () => void;
  c: ThemeColors;
}

export function WeekRow({
  week,
  index,
  visits,
  onIncrement,
  onDecrement,
  c,
}: WeekRowProps) {
  const isLastWeek = week.dayEnd === 60;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 14,
        borderRadius: 14,
        backgroundColor: isLastWeek ? c.accent : c.card,
        borderWidth: 1,
        borderColor: isLastWeek ? c.accentForeground + "20" : c.border,
        marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: isLastWeek
              ? c.accentForeground + "20"
              : c.primaryLight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontWeight: "700",
              fontSize: 13,
              color: isLastWeek ? c.accentForeground : c.primary,
            }}
          >
            W{week.weekNumber}
          </Text>
        </View>
        <View>
          <Text style={{ fontWeight: "600", fontSize: 14, color: c.text }}>
            {format(week.startDate, "MMM d")} -{" "}
            {format(week.endDate, "MMM d")}
          </Text>
          <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>
            {week.daysInWeek} {week.daysInWeek === 1 ? "day" : "days"} (Days {week.dayStart}-{week.dayEnd})
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable
          onPress={onDecrement}
          style={{
            width: 36,
            height: 36,
            borderWidth: 1,
            borderColor: c.border,
            borderTopLeftRadius: 8,
            borderBottomLeftRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.card,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "600", color: c.text }}>
            −
          </Text>
        </Pressable>
        <View
          style={{
            width: 44,
            height: 36,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: c.border,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.inputBg,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: c.text,
              fontVariant: ["tabular-nums"],
            }}
          >
            {visits}
          </Text>
        </View>
        <Pressable
          onPress={onIncrement}
          style={{
            width: 36,
            height: 36,
            borderWidth: 1,
            borderColor: c.border,
            borderTopRightRadius: 8,
            borderBottomRightRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.card,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "600", color: c.text }}>
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
