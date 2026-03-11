import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useLocation, useSearch } from "wouter";
import {
  Send,
  Loader2,
  Bookmark,
  BookmarkCheck,
  Archive,
  Download,
  Plus,
  ChevronDown,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sourcesJson?: Array<{ name: string; type: string; score: number }>;
}

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { hasPermission } = useAuth();
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  // Parse conversation ID from URL query params
  const urlConversationId = new URLSearchParams(searchString).get("conversation");

  // Load existing conversation from URL
  const { data: existingMessages, isLoading: loadingConversation } = useQuery<Message[]>({
    queryKey: ["/api/conversations", urlConversationId, "messages"],
    queryFn: async () => {
      if (!urlConversationId) return [];
      const res = await fetch(`/api/conversations/${urlConversationId}/messages`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!urlConversationId,
  });

  // When existing messages load, set them
  useEffect(() => {
    if (existingMessages && existingMessages.length > 0 && urlConversationId) {
      setLocalMessages(existingMessages);
      setConversationId(urlConversationId);
    }
  }, [existingMessages, urlConversationId]);

  const askMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/ask", {
        question: q,
        conversationId: conversationId || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setConversationId(data.conversationId);
      setLocalMessages((prev) => [...prev, data.message]);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ question, answer }: { question: string; answer: string }) => {
      const res = await apiRequest("POST", "/api/saved-answers", { question, answer });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-answers"] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (convId: string) => {
      const res = await apiRequest("PATCH", `/api/conversations/${convId}/archive`, {
        isArchived: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      handleNewConversation();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || askMutation.isPending) return;

    const userMsg: Message = {
      id: `local-${Date.now()}`,
      role: "user",
      content: question,
      createdAt: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMsg]);
    askMutation.mutate(question);
    setQuestion("");
  };

  const handleSaveAnswer = (assistantMsg: Message) => {
    // Find the preceding user message
    const msgIndex = localMessages.findIndex((m) => m.id === assistantMsg.id);
    if (msgIndex <= 0) return;

    const userMsg = localMessages[msgIndex - 1];
    if (userMsg.role !== "user") return;

    saveMutation.mutate(
      { question: userMsg.content, answer: assistantMsg.content },
      {
        onSuccess: () => {
          setSavedMessageIds((prev) => new Set(prev).add(assistantMsg.id));
        },
      },
    );
  };

  const handleNewConversation = () => {
    setConversationId(null);
    setLocalMessages([]);
    setSavedMessageIds(new Set());
    setShowExportMenu(false);
    setLocation("/ask");
  };

  const handleExport = async (format: "json" | "text") => {
    if (!conversationId) return;
    setShowExportMenu(false);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/export?format=${format}`, {
        credentials: "include",
      });
      if (!res.ok) return;

      if (format === "text") {
        const text = await res.text();
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ducky-conversation-${conversationId.slice(0, 8)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ducky-conversation-${conversationId.slice(0, 8)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // Silently fail export
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      {localMessages.length > 0 && (
        <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--theme-border)] bg-[var(--bg-primary)]">
          <button
            onClick={handleNewConversation}
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-amber-500 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Conversation
          </button>

          <div className="flex items-center gap-2">
            {conversationId && (
              <>
                {/* Export */}
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-card)] transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 top-full mt-1 w-32 bg-[var(--bg-card)] border border-[var(--theme-border)] rounded-lg shadow-lg overflow-hidden z-10">
                      <button
                        onClick={() => handleExport("json")}
                        className="w-full px-3 py-2 text-xs text-left text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors"
                      >
                        JSON
                      </button>
                      <button
                        onClick={() => handleExport("text")}
                        className="w-full px-3 py-2 text-xs text-left text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors"
                      >
                        Plain Text
                      </button>
                    </div>
                  )}
                </div>

                {/* Archive */}
                <button
                  onClick={() => archiveMutation.mutate(conversationId)}
                  disabled={archiveMutation.isPending}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-card)] transition-colors"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archive
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto p-6">
        {loadingConversation && urlConversationId ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[var(--text-secondary)] mt-3">Loading conversation...</p>
          </div>
        ) : localMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
              <span className="text-3xl">🦆</span>
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Ask Ducky</h2>
            <p className="text-[var(--text-secondary)] max-w-md">
              Ask any question and get an AI-powered answer instantly.
              Your conversations are saved automatically.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {localMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-amber-500 text-white"
                      : "bg-[var(--bg-card)] border border-[var(--theme-border)] text-[var(--text-primary)]"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                  {/* Sources from RAG */}
                  {msg.role === "assistant" && msg.sourcesJson && msg.sourcesJson.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[var(--theme-border)]">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--text-disabled)] mb-1">Sources</p>
                      <div className="flex flex-wrap gap-1">
                        {msg.sourcesJson.map((s, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600"
                          >
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Save button for assistant messages */}
                  {msg.role === "assistant" && hasPermission("save_answers") && (
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => handleSaveAnswer(msg)}
                        disabled={savedMessageIds.has(msg.id) || saveMutation.isPending}
                        className="flex items-center gap-1 text-[10px] text-[var(--text-disabled)] hover:text-amber-500 transition-colors disabled:opacity-50"
                        title={savedMessageIds.has(msg.id) ? "Saved" : "Save this answer"}
                      >
                        {savedMessageIds.has(msg.id) ? (
                          <BookmarkCheck className="h-3 w-3 text-amber-500" />
                        ) : (
                          <Bookmark className="h-3 w-3" />
                        )}
                        {savedMessageIds.has(msg.id) ? "Saved" : "Save"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {askMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-[var(--bg-card)] border border-[var(--theme-border)] rounded-xl px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[var(--theme-border)] p-4 bg-[var(--bg-primary)]">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask Ducky anything..."
            className="flex-1 bg-[var(--bg-card)] border border-[var(--theme-border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
            disabled={askMutation.isPending}
          />
          <button
            type="submit"
            disabled={!question.trim() || askMutation.isPending}
            className="px-4 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
