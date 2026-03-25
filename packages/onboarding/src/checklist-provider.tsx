import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ChecklistConfig, ChecklistItem } from "./types";
import { getOnboardingState, markChecklistItem, dismissChecklist as dismissChecklistStorage } from "./storage";

interface ChecklistContextValue {
  /** The configured checklist items */
  items: ChecklistItem[];
  /** Map of item ID → completed boolean */
  completedItems: Record<string, boolean>;
  /** Mark a checklist item as completed */
  markComplete: (itemId: string) => void;
  /** Whether all items are completed */
  isAllComplete: boolean;
  /** Progress percentage 0-100 */
  progress: number;
  /** Whether the checklist panel is visible */
  isVisible: boolean;
  /** Dismiss (hide) the checklist permanently */
  dismiss: () => void;
  /** Show / collapse the checklist card */
  isExpanded: boolean;
  /** Toggle collapse state */
  toggleExpanded: () => void;
  /** App display name */
  appDisplayName: string;
}

const ChecklistContext = createContext<ChecklistContextValue | null>(null);

export function ChecklistProvider({
  config,
  children,
}: {
  config: ChecklistConfig;
  children: ReactNode;
}) {
  const { appCode, items, appDisplayName } = config;
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [celebrated, setCelebrated] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    const state = getOnboardingState(appCode);
    setCompletedItems(state.checklistItems);
    // Only show checklist if tour is done and checklist not dismissed
    setIsVisible(state.tourCompleted && !state.checklistDismissed);
  }, [appCode]);

  const completedCount = useMemo(
    () => items.filter((item) => completedItems[item.id]).length,
    [items, completedItems],
  );
  const progress = items.length === 0 ? 100 : Math.round((completedCount / items.length) * 100);
  const isAllComplete = completedCount === items.length;

  // Auto-dismiss after celebration
  useEffect(() => {
    if (isAllComplete && !celebrated) {
      setCelebrated(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        dismissChecklistStorage(appCode);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isAllComplete, celebrated, appCode]);

  const markComplete = useCallback(
    (itemId: string) => {
      markChecklistItem(appCode, itemId);
      setCompletedItems((prev: Record<string, boolean>) => ({ ...prev, [itemId]: true }));
    },
    [appCode],
  );

  const dismiss = useCallback(() => {
    setIsVisible(false);
    dismissChecklistStorage(appCode);
  }, [appCode]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev: boolean) => !prev);
  }, []);

  const value = useMemo<ChecklistContextValue>(
    () => ({
      items,
      completedItems,
      markComplete,
      isAllComplete,
      progress,
      isVisible,
      dismiss,
      isExpanded,
      toggleExpanded,
      appDisplayName,
    }),
    [items, completedItems, markComplete, isAllComplete, progress, isVisible, dismiss, isExpanded, toggleExpanded, appDisplayName],
  );

  return <ChecklistContext.Provider value={value}>{children}</ChecklistContext.Provider>;
}

export function useChecklist(): ChecklistContextValue {
  const ctx = useContext(ChecklistContext);
  if (!ctx) throw new Error("useChecklist must be used within a ChecklistProvider");
  return ctx;
}
