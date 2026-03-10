import { useQuery } from "@tanstack/react-query";
import { BookOpen, Plus } from "lucide-react";

export default function KnowledgePage() {
  const { data: sources, isLoading } = useQuery<any[]>({
    queryKey: ["/api/knowledge"],
  });

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Knowledge Base</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage the sources that Ducky uses to answer questions
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium">
          <Plus className="h-4 w-4" />
          Add Source
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sources && sources.length > 0 ? (
        <div className="space-y-3">
          {sources.map((source: any) => (
            <div
              key={source.id}
              className="p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--bg-card)] flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--text-primary)]">{source.name}</p>
                <p className="text-xs text-[var(--text-secondary)]">{source.sourceType}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${source.isActive ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}`}>
                {source.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-[var(--text-disabled)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">No knowledge sources yet</p>
          <p className="text-sm text-[var(--text-disabled)] mt-1">Add documents, URLs, or manual entries to enhance Ducky's answers</p>
        </div>
      )}
    </div>
  );
}
