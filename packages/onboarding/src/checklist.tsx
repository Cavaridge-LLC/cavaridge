import { useChecklist } from "./checklist-provider";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X, PartyPopper } from "lucide-react";

/**
 * Fixed bottom-right floating checklist card.
 * Tracks first-time user tasks with visual progress.
 */
export function Checklist({ onNavigate }: { onNavigate?: (route: string) => void }) {
  const {
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
  } = useChecklist();

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9990] w-80 rounded-xl border bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
      role="complementary"
      aria-label="Getting started checklist"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
            {isAllComplete ? "All done!" : `Getting started with ${appDisplayName}`}
          </h3>
          {/* Progress bar */}
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1 ml-3">
          <button
            type="button"
            onClick={toggleExpanded}
            className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"
            aria-label={isExpanded ? "Collapse checklist" : "Expand checklist"}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"
            aria-label="Dismiss checklist"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Items */}
      {isExpanded && (
        <div className="px-4 py-2">
          {isAllComplete ? (
            <div className="flex flex-col items-center py-4 text-center">
              <PartyPopper className="w-8 h-8 text-amber-500 mb-2" />
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                You've completed all the getting started tasks!
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {items.map((item) => {
                const done = !!completedItems[item.id];
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex items-start gap-3 w-full text-left px-2 py-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group"
                      onClick={() => {
                        if (!done) markComplete(item.id);
                        if (item.route && onNavigate) onNavigate(item.route);
                      }}
                    >
                      {done ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-neutral-300 dark:text-neutral-600 mt-0.5 flex-shrink-0 group-hover:text-blue-400 transition-colors" />
                      )}
                      <div className="min-w-0">
                        <p
                          className={`text-sm ${
                            done
                              ? "line-through text-neutral-400 dark:text-neutral-500"
                              : "text-neutral-700 dark:text-neutral-300"
                          }`}
                        >
                          {item.label}
                        </p>
                        {item.description && !done && (
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
