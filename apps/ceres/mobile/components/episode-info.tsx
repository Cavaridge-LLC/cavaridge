import { View, Text, Pressable, Platform } from "react-native";
import { format } from "date-fns";
import { EpisodeDetails } from "@/utils/episode";
import { ThemeColors } from "@/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

interface EpisodeInfoProps {
  socDate: Date;
  onDateChange: (date: Date) => void;
  episode: EpisodeDetails | null;
  c: ThemeColors;
}

export function EpisodeInfo({
  socDate,
  onDateChange,
  episode,
  c,
}: EpisodeInfoProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempYear, setTempYear] = useState("");
  const [tempMonth, setTempMonth] = useState("");
  const [tempDay, setTempDay] = useState("");

  const openDateEditor = () => {
    setTempYear(String(socDate.getFullYear()));
    setTempMonth(String(socDate.getMonth() + 1).padStart(2, "0"));
    setTempDay(String(socDate.getDate()).padStart(2, "0"));
    setShowPicker(true);
  };

  const adjustDate = (field: "year" | "month" | "day", delta: number) => {
    const newDate = new Date(socDate);
    if (field === "year") newDate.setFullYear(newDate.getFullYear() + delta);
    if (field === "month") newDate.setMonth(newDate.getMonth() + delta);
    if (field === "day") newDate.setDate(newDate.getDate() + delta);
    onDateChange(newDate);
  };

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <Ionicons name="calendar-outline" size={20} color={c.primary} />
        <Text style={{ fontSize: 17, fontWeight: "700", color: c.text }}>
          Episode Timeline
        </Text>
      </View>

      <Text
        style={{
          fontSize: 13,
          color: c.textSecondary,
          marginBottom: 12,
        }}
      >
        Enter the patient's SOC date
      </Text>

      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: c.text,
          marginBottom: 6,
        }}
      >
        Start of Care (SOC) Date
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            height: 48,
            backgroundColor: c.inputBg,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border,
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          <Pressable
            onPress={() => adjustDate("day", -1)}
            style={{
              width: 42,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: c.accent,
            }}
          >
            <Ionicons name="chevron-back" size={18} color={c.text} />
          </Pressable>

          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Ionicons name="calendar" size={18} color={c.textMuted} />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: c.text,
                fontVariant: ["tabular-nums"],
              }}
            >
              {format(socDate, "yyyy-MM-dd")}
            </Text>
          </View>

          <Pressable
            onPress={() => adjustDate("day", 1)}
            style={{
              width: 42,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: c.accent,
            }}
          >
            <Ionicons name="chevron-forward" size={18} color={c.text} />
          </Pressable>
        </View>
      </View>

      {episode && (
        <View
          style={{
            backgroundColor: c.accent,
            borderRadius: 12,
            padding: 14,
            gap: 12,
            borderWidth: 1,
            borderColor: c.border + "80",
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: c.textMuted,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 2,
              }}
            >
              Episode Start (Day 1)
            </Text>
            <Text
              selectable
              style={{ fontSize: 15, fontWeight: "600", color: c.text }}
            >
              {format(episode.startDate, "EEEE, MMMM d, yyyy")}
            </Text>
          </View>
          <View>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: c.textMuted,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 2,
              }}
            >
              Episode End (Day 60)
            </Text>
            <Text
              selectable
              style={{ fontSize: 15, fontWeight: "600", color: c.text }}
            >
              {format(episode.endDate, "EEEE, MMMM d, yyyy")}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
