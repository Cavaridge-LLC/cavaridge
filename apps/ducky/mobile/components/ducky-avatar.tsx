/**
 * Ducky Intelligence Mascot Avatar
 *
 * Placeholder using emoji. Will be replaced with Lottie animations
 * from @cavaridge/ducky-animations (9 states: idle, listening,
 * thinking, searching, found, presenting, error, celebrating, sleeping).
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

interface DuckyAvatarProps {
  state?: DuckyState;
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZE_MAP = {
  sm: { container: 28, emoji: 14 },
  md: { container: 36, emoji: 18 },
  lg: { container: 48, emoji: 24 },
  xl: { container: 72, emoji: 36 },
};

export function DuckyAvatar({ state = "idle", size = "md" }: DuckyAvatarProps) {
  const s = SIZE_MAP[size];

  return (
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
      <Text style={{ fontSize: s.emoji }}>🐕</Text>
    </View>
  );
}
