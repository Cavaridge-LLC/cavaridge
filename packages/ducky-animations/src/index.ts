// Components
export { DuckyAnimation } from "./DuckyAnimation";
export { DuckyMascot } from "./DuckyMascot";
export { DuckyFooter } from "./DuckyFooter";

// Hook
export { useDuckyState } from "./useDuckyState";

// Types
export type {
  DuckyAnimationState,
  AgentStatus,
  DuckySize,
  DuckyTheme,
  DuckyAnimationProps,
  DuckyMascotProps,
  DuckyFooterProps,
} from "./types";

// Constants
export { AGENT_STATUS_TO_ANIMATION, DUCKY_SIZE_MAP } from "./types";

// CSS path — web consumers should import "@cavaridge/ducky-animations/animations.css"
// or include it via their bundler. React Native consumers skip CSS entirely
// and will use the Lottie-based replacement when animation files are available.
