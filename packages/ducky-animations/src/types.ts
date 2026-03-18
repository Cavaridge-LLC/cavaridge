export type DuckyAnimationState =
  | "idle"
  | "listening"
  | "thinking"
  | "searching"
  | "found"
  | "presenting"
  | "error"
  | "celebrating"
  | "sleeping";

export interface DuckyAnimationProps {
  state?: DuckyAnimationState;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const DUCKY_SIZE_MAP: Record<NonNullable<DuckyAnimationProps["size"]>, number> = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};
