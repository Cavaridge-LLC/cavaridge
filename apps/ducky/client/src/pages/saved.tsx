import { useQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";

export default function SavedPage() {
  const { data: savedAnswers, isLoading } = useQuery<any[]>({
    queryKey: ["/api/saved-answers"],
  });

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Saved Answers</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Your bookmarked questions and answers
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : savedAnswers && savedAnswers.length > 0 ? (
        <div className="space-y-4">
          {savedAnswers.map((item: any) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--bg-card)]"
            >
              <p className="text-sm font-medium text-amber-500 mb-2">{item.question}</p>
              <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{item.answer}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-[var(--text-disabled)]">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Bookmark className="h-12 w-12 text-[var(--text-disabled)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">No saved answers yet</p>
          <p className="text-sm text-[var(--text-disabled)] mt-1">Save answers from conversations to reference them later</p>
        </div>
      )}
    </div>
  );
}
