import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MessageSquare, BookOpen, Bookmark, Sparkles } from "lucide-react";

export default function HomePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: conversations } = useQuery<any[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: savedAnswers } = useQuery<any[]>({
    queryKey: ["/api/saved-answers"],
  });

  const { data: knowledgeSources } = useQuery<any[]>({
    queryKey: ["/api/knowledge"],
  });

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">
          Welcome back, {user?.name?.split(" ")[0]}
        </h2>
        <p className="text-[var(--text-secondary)] mt-1">
          What would you like to know today?
        </p>
      </div>

      {/* Quick Ask */}
      <button
        onClick={() => setLocation("/ask")}
        className="w-full mb-8 p-6 rounded-xl border border-[var(--theme-border)] bg-[var(--bg-card)] hover:border-amber-500/30 transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
            <Sparkles className="h-6 w-6 text-amber-500" />
          </div>
          <div className="text-left">
            <p className="text-lg font-semibold text-[var(--text-primary)]">Ask Ducky anything</p>
            <p className="text-sm text-[var(--text-secondary)]">Get instant AI-powered answers</p>
          </div>
        </div>
      </button>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--bg-card)]">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-[var(--text-secondary)]">Conversations</span>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{conversations?.length || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--bg-card)]">
          <div className="flex items-center gap-2 mb-2">
            <Bookmark className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-[var(--text-secondary)]">Saved Answers</span>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{savedAnswers?.length || 0}</p>
        </div>
        <div className="p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--bg-card)]">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-[var(--text-secondary)]">Knowledge Sources</span>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{knowledgeSources?.length || 0}</p>
        </div>
      </div>

      {/* Recent Conversations */}
      {conversations && conversations.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wide">Recent Conversations</h3>
          <div className="space-y-2">
            {conversations.slice(0, 5).map((conv: any) => (
              <button
                key={conv.id}
                onClick={() => setLocation(`/ask?conversation=${conv.id}`)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--theme-border)] bg-[var(--bg-card)] hover:border-amber-500/20 transition-colors text-left"
              >
                <MessageSquare className="h-4 w-4 text-[var(--text-disabled)]" />
                <span className="text-sm text-[var(--text-primary)] truncate flex-1">{conv.title || "Untitled conversation"}</span>
                <span className="text-xs text-[var(--text-disabled)]">
                  {new Date(conv.updatedAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
