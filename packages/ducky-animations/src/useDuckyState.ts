import { useState, useEffect, useCallback, useRef } from "react";
import type { AgentStatus, DuckyAnimationState } from "./types";
import { AGENT_STATUS_TO_ANIMATION } from "./types";

interface UseDuckyStateOptions {
  /** Delay before transitioning to the next state (ms). Default: 0 */
  transitionDelay?: number;
  /** Auto-return to idle after completing a terminal state (ms). 0 = disabled. Default: 3000 */
  autoIdleAfter?: number;
}

const TERMINAL_STATES: DuckyAnimationState[] = ["celebrating", "found", "error"];

/**
 * Hook that maps agent status to Ducky animation state with optional
 * transition delay and auto-idle return for terminal states.
 */
export function useDuckyState(
  agentStatus: AgentStatus = "idle",
  options: UseDuckyStateOptions = {}
) {
  const { transitionDelay = 0, autoIdleAfter = 3000 } = options;
  const [animationState, setAnimationState] = useState<DuckyAnimationState>(
    AGENT_STATUS_TO_ANIMATION[agentStatus]
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearTimer();
    const target = AGENT_STATUS_TO_ANIMATION[agentStatus];

    const apply = () => {
      setAnimationState(target);

      if (autoIdleAfter > 0 && TERMINAL_STATES.includes(target)) {
        timerRef.current = setTimeout(() => {
          setAnimationState("idle");
        }, autoIdleAfter);
      }
    };

    if (transitionDelay > 0) {
      timerRef.current = setTimeout(apply, transitionDelay);
    } else {
      apply();
    }

    return clearTimer;
  }, [agentStatus, transitionDelay, autoIdleAfter, clearTimer]);

  /** Imperatively set the animation state. */
  const setManualState = useCallback(
    (state: DuckyAnimationState) => {
      clearTimer();
      setAnimationState(state);
    },
    [clearTimer]
  );

  return { animationState, setAnimationState: setManualState } as const;
}
