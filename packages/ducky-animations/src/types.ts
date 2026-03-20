/** The 9 Lottie animation states for the Ducky mascot. */
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

/** Agent statuses emitted by Cavaridge app agents. */
export type AgentStatus =
  | "idle"
  | "listening"
  | "processing"
  | "researching"
  | "analyzing"
  | "generating"
  | "complete"
  | "error"
  | "presenting"
  | "waiting"
  | "sleeping";

/** Maps agent statuses to the animation state Ducky should play. */
export const AGENT_STATUS_TO_ANIMATION: Record<AgentStatus, DuckyAnimationState> = {
  idle: "idle",
  listening: "listening",
  processing: "thinking",
  researching: "searching",
  analyzing: "thinking",
  generating: "thinking",
  complete: "celebrating",
  error: "error",
  presenting: "presenting",
  waiting: "idle",
  sleeping: "sleeping",
};

export type DuckySize = "sm" | "md" | "lg" | "xl";

export const DUCKY_SIZE_MAP: Record<DuckySize, number> = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

export type DuckyTheme = "light" | "dark" | "system";

export interface DuckyAnimationProps {
  state?: DuckyAnimationState;
  size?: DuckySize;
  className?: string;
  theme?: DuckyTheme;
}

export interface DuckyMascotProps {
  /** Agent status — automatically mapped to the correct animation state. */
  agentStatus?: AgentStatus;
  /** Override: set animation state directly (takes precedence over agentStatus). */
  animationState?: DuckyAnimationState;
  size?: DuckySize;
  className?: string;
  theme?: DuckyTheme;
}

export interface DuckyFooterProps {
  /** Show the mini mascot next to the text. Default: true */
  showMascot?: boolean;
  /** Override the default tagline. */
  tagline?: string;
  className?: string;
  theme?: DuckyTheme;
}
