/**
 * Recall Page — Natural Language Knowledge Query
 *
 * "Ducky, what did we decide about the migration timeline?"
 * Searches knowledge objects by semantic similarity, synthesizes answer.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, Send, Loader2, MessageCircle, ExternalLink } from "lucide-react";
import { api } from "../hooks/useApi.js";

interface RecallResult {
  query: string;
  answer: string;
  sources: Array<{
    type: string;
    content: string;
    similarity: number;
    createdAt: string;
  }>;
  totalMatches: number;
  timestamp: number;
}

export function RecallPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<RecallResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleRecall = useCallback(async () => {
    if (!query.trim() || loading) return;

    setLoading(true);
    const q = query.trim();
    setQuery("");

    try {
      const result = await api.recall({ query: q });
      setHistory((prev) => [
        {
          query: q,
          answer: result.answer,
          sources: result.sources as RecallResult["sources"],
          totalMatches: result.totalMatches,
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    } catch (err) {
      setHistory((prev) => [
        {
          query: q,
          answer: `Recall failed: ${err instanceof Error ? err.message : "Unknown error"}`,
          sources: [],
          totalMatches: 0,
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    } finally {
      setLoading(false);
    }
  }, [query, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleRecall();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-[var(--brain-border)]">
        <h1 className="text-2xl font-bold text-[var(--brain-text)]">Recall</h1>
        <p className="text-sm text-[var(--brain-text-muted)]">
          Ask Ducky anything about your captured knowledge
        </p>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-auto p-6" ref={resultsRef}>
        {history.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-[var(--brain-surface-alt)] flex items-center justify-center mb-4">
              <MessageCircle className="w-10 h-10 text-[var(--brain-text-muted)]" />
            </div>
            <h2 className="text-lg font-medium text-[var(--brain-text)] mb-2">Ask Ducky</h2>
            <p className="text-sm text-[var(--brain-text-muted)] max-w-md">
              Ask questions about anything you've captured. Try:
            </p>
            <div className="flex flex-col gap-2 mt-4">
              {[
                "What did we decide about the migration timeline?",
                "What are the open action items from last week?",
                "Who is responsible for the security audit?",
                "What technologies did we discuss for the new project?",
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => {
                    setQuery(example);
                    inputRef.current?.focus();
                  }}
                  className="text-sm text-[var(--brain-primary)] hover:underline text-left"
                >
                  "{example}"
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 p-4 mb-4 bg-[var(--brain-surface-alt)] rounded-lg border border-[var(--brain-border)]">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--brain-primary)]" />
            <span className="text-sm text-[var(--brain-text-muted)]">Searching knowledge base...</span>
          </div>
        )}

        {history.map((result, i) => (
          <div key={result.timestamp} className="mb-6">
            {/* Query */}
            <div className="flex justify-end mb-3">
              <div className="max-w-lg bg-[var(--brain-primary)] text-white rounded-2xl rounded-tr-md px-4 py-2.5">
                <p className="text-sm">{result.query}</p>
              </div>
            </div>

            {/* Answer */}
            <div className="flex justify-start">
              <div className="max-w-2xl">
                <div className="bg-[var(--brain-surface-alt)] rounded-2xl rounded-tl-md px-4 py-3 border border-[var(--brain-border)]">
                  <p className="text-sm text-[var(--brain-text)] leading-relaxed whitespace-pre-wrap">
                    {result.answer}
                  </p>
                </div>

                {/* Sources */}
                {result.sources.length > 0 && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {result.sources.map((source, j) => (
                      <span
                        key={j}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-[var(--brain-text-muted)]"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {source.type} ({Math.round(source.similarity * 100)}%)
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-xs text-[var(--brain-text-muted)] mt-1">
                  {result.totalMatches} source{result.totalMatches !== 1 ? "s" : ""} found
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input Bar */}
      <div className="p-4 border-t border-[var(--brain-border)] bg-[var(--brain-surface)]">
        <div className="max-w-3xl mx-auto flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--brain-text-muted)]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Ducky a question..."
              disabled={loading}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--brain-border)] bg-[var(--brain-surface-alt)] text-sm text-[var(--brain-text)] placeholder:text-[var(--brain-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brain-primary)]/30 disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleRecall}
            disabled={!query.trim() || loading}
            className="px-4 py-3 rounded-xl bg-[var(--brain-primary)] text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
