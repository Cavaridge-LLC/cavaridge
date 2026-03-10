import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Loader2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-auto p-6">
        {localMessages.length === 0 ? (
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
