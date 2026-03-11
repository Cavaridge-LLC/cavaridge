import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BookOpen, Plus, Globe, FileText, Edit3, Trash2, X, Loader2, Database } from "lucide-react";
import { useAuth } from "@/lib/auth";

type SourceType = "manual" | "url" | "document";

export default function KnowledgePage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("manage_knowledge");
  const [showAdd, setShowAdd] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>("manual");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const { data: sources, isLoading } = useQuery<any[]>({
    queryKey: ["/api/knowledge"],
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/knowledge", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
      resetForm();
    },
    onError: (err: any) => setError(err.message || "Failed to create source"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/knowledge/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/knowledge/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
    },
  });

  function resetForm() {
    setShowAdd(false);
    setSourceType("manual");
    setName("");
    setContent("");
    setUrl("");
    setError("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Name is required"); return; }

    const payload: any = { name: name.trim(), sourceType };

    if (sourceType === "manual") {
      if (!content.trim()) { setError("Content is required for manual entries"); return; }
      payload.content = content.trim();
    } else if (sourceType === "url") {
      if (!url.trim()) { setError("URL is required"); return; }
      payload.metadataJson = { url: url.trim() };
    } else if (sourceType === "document") {
      if (!content.trim()) { setError("Paste your document text content"); return; }
      payload.content = content.trim();
    }

    createMutation.mutate(payload);
  }

  const sourceTypeIcon = (type: string) => {
    switch (type) {
      case "url": return <Globe className="h-5 w-5 text-amber-500" />;
      case "document": return <FileText className="h-5 w-5 text-amber-500" />;
      case "manual": return <Edit3 className="h-5 w-5 text-amber-500" />;
      default: return <BookOpen className="h-5 w-5 text-amber-500" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Knowledge Base</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage the sources that Ducky uses to answer questions
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Source
          </button>
        )}
      </div>

      {/* Add Source Dialog */}
      {showAdd && (
        <div className="mb-6 p-6 rounded-xl border border-amber-500/30 bg-[var(--bg-card)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Add Knowledge Source</h3>
            <button onClick={resetForm} className="text-[var(--text-disabled)] hover:text-[var(--text-primary)]">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Source Type Tabs */}
          <div className="flex gap-2 mb-4">
            {([
              { value: "manual" as const, label: "Manual Text", icon: Edit3 },
              { value: "url" as const, label: "URL", icon: Globe },
              { value: "document" as const, label: "Document", icon: FileText },
            ]).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setSourceType(value)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sourceType === value
                    ? "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                    : "bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--theme-border)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-secondary)] block mb-1">Source Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Company Policies, Product Docs"
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            {sourceType === "url" && (
              <div>
                <label className="text-xs text-[var(--text-secondary)] block mb-1">URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/docs"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>
            )}

            {(sourceType === "manual" || sourceType === "document") && (
              <div>
                <label className="text-xs text-[var(--text-secondary)] block mb-1">
                  {sourceType === "document" ? "Paste Document Text" : "Content"}
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={sourceType === "document" ? "Paste the full text of your document here..." : "Enter knowledge content..."}
                  rows={8}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-y"
                />
              </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Ingesting...</>
                ) : (
                  <><Database className="h-4 w-4" /> Add & Ingest</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Source List */}
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
                {sourceTypeIcon(source.sourceType)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">{source.name}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {source.sourceType} · {source.chunkCount ?? 0} chunks
                </p>
              </div>
              <button
                onClick={() => toggleMutation.mutate({ id: source.id, isActive: !source.isActive })}
                className={`text-xs px-2 py-1 rounded-full cursor-pointer transition-colors ${
                  source.isActive ? "bg-green-500/10 text-green-400 hover:bg-green-500/20" : "bg-gray-500/10 text-gray-400 hover:bg-gray-500/20"
                }`}
              >
                {source.isActive ? "Active" : "Inactive"}
              </button>
              {canManage && (
                <button
                  onClick={() => { if (confirm("Delete this knowledge source?")) deleteMutation.mutate(source.id); }}
                  className="text-[var(--text-disabled)] hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
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
