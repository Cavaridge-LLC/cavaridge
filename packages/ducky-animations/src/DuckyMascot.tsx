import type { DuckyMascotProps } from "./types";
import { AGENT_STATUS_TO_ANIMATION } from "./types";
import { DuckyAnimation } from "./DuckyAnimation";

/**
 * High-level Ducky mascot component.
 * Accepts an `agentStatus` prop and maps it to the correct animation state
 * via the state machine defined in AGENT_STATUS_TO_ANIMATION.
 *
 * Use `animationState` to override the state machine directly.
 */
export function DuckyMascot({
  agentStatus = "idle",
  animationState,
  size = "md",
  className,
  theme,
}: DuckyMascotProps) {
  const resolvedState = animationState ?? AGENT_STATUS_TO_ANIMATION[agentStatus];

  return (
    <DuckyAnimation
      state={resolvedState}
      size={size}
      className={className}
      theme={theme}
    />
  );
}
