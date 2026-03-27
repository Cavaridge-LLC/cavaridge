/**
 * Ducky Intelligence Mascot — React Native.
 *
 * Renders the actual Blenheim Cavalier SVG inline.
 * When @cavaridge/ducky-animations Lottie files ship,
 * this will switch to the animated Lottie player.
 */

import { View, Text } from "react-native";
import Svg, { Ellipse, Circle, Path } from "react-native-svg";

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
  sm: { container: 28, svg: 18 },
  md: { container: 40, svg: 28 },
  lg: { container: 56, svg: 40 },
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

function DuckySvg({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Ellipse cx={32} cy={38} rx={18} ry={16} fill="#F5A623" />
      <Circle cx={32} cy={20} r={14} fill="#F5A623" />
      <Ellipse cx={19} cy={16} rx={6} ry={10} fill="#C47A1A" rotation={-15} origin="19, 16" />
      <Ellipse cx={45} cy={16} rx={6} ry={10} fill="#C47A1A" rotation={15} origin="45, 16" />
      <Ellipse cx={32} cy={18} rx={5} ry={7} fill="#FFFFFF" opacity={0.85} />
      <Circle cx={27} cy={19} r={2.5} fill="#2D1B0E" />
      <Circle cx={27.8} cy={18.2} r={0.8} fill="#FFFFFF" />
      <Circle cx={37} cy={19} r={2.5} fill="#2D1B0E" />
      <Circle cx={37.8} cy={18.2} r={0.8} fill="#FFFFFF" />
      <Ellipse cx={32} cy={24} rx={2} ry={1.5} fill="#2D1B0E" />
      <Path d="M30 25.5 Q32 27.5 34 25.5" stroke="#2D1B0E" strokeWidth={0.8} fill="none" strokeLinecap="round" />
      <Ellipse cx={32} cy={34} rx={8} ry={6} fill="#FFFFFF" opacity={0.7} />
      <Ellipse cx={24} cy={50} rx={4} ry={3} fill="#F5A623" />
      <Ellipse cx={40} cy={50} rx={4} ry={3} fill="#F5A623" />
      <Ellipse cx={49} cy={36} rx={3} ry={2} fill="#C47A1A" rotation={-30} origin="49, 36" />
    </Svg>
  );
}

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
        accessibilityRole="image"
        accessibilityLabel="Ducky — Cavaridge Intelligence mascot"
      >
        <DuckySvg size={s.svg} />
      </View>
      {state !== "idle" && STATE_LABELS[state] ? (
        <Text style={{ fontSize: 11, color: colors.textSecondary, fontStyle: "italic" }}>
          {STATE_LABELS[state]}
        </Text>
      ) : null}
    </View>
  );
}
