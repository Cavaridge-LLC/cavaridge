/**
 * Ducky Intelligence Mascot — React Native Placeholder
 *
 * Will be replaced with Lottie animations from @cavaridge/ducky-animations.
 * 9 animation states: idle, listening, thinking, searching, found,
 * presenting, error, celebrating, sleeping.
 */

import { View, Text } from "react-native";

export type DuckyState =
  | "idle"
  | "listening"
  | "thinking"
  | "searching"
  | "found"
  | "presenting"
  | "error"
  | "celebrating"
  | "sleeping";

interface DuckyMascotProps {
  state?: DuckyState;
  size?: "sm" | "md" | "lg";
  colors: { text: string; textSecondary: string };
}

const SIZE_MAP = {
  sm: { container: 28, emoji: 14 },
  md: { container: 40, emoji: 20 },
  lg: { container: 56, emoji: 28 },
};

const STATE_LABELS: Record<DuckyState, string> = {
  idle: "",
  listening: "Listening...",
  thinking: "Thinking...",
  searching: "Searching...",
  found: "Found it!",
  presenting: "Here you go",
  error: "Oops!",
  celebrating: "Done!",
  sleeping: "Zzz...",
};

export function DuckyMascot({ state = "idle", size = "md", colors }: DuckyMascotProps) {
  const s = SIZE_MAP[size];

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View
        style={{
          width: s.container,
          height: s.container,
          borderRadius: s.container / 2,
          backgroundColor: "#FEF3C7",
          borderWidth: 2,
          borderColor: "#FCD34D",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: s.emoji }}>🐶</Text>
      </View>
      {state !== "idle" && STATE_LABELS[state] ? (
        <Text style={{ fontSize: 11, color: colors.textSecondary, fontStyle: "italic" }}>
          {STATE_LABELS[state]}
        </Text>
      ) : null}
    </View>
  );
}
