import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bookmark, Trash2 } from "lucide-react";

export default function SavedPage() {
  const { data: savedAnswers, isLoading } = useQuery<any[]>({
    queryKey: ["/api/saved-answers"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/saved-answers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-answers"] });
    },
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
              className="p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--bg-card)] group"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-amber-500 mb-2 flex-1">{item.question}</p>
                <button
                  onClick={() => deleteMutation.mutate(item.id)}
                  disabled={deleteMutation.isPending}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[var(--text-disabled)] hover:text-red-500 hover:bg-red-500/10 transition-all"
                  title="Delete saved answer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{item.answer}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-[var(--text-disabled)]">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
                {item.tags && item.tags.length > 0 && (
                  <div className="flex gap-1">
                    {item.tags.map((tag: string, i: number) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
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
