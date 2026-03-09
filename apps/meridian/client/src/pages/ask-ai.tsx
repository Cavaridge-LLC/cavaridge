import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Send,
  CheckCircle2,
  FileText,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Eye,
  Plus,
  Search,
  Trash2,
  Bookmark,
  Copy,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  Clock,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Deal, QaConversation, QaMessage, Document } from "@shared/schema";
import DocumentPreview from "@/components/document-preview";

interface Citation {
  document_id?: string;
  document_name?: string;
  chunk_text?: string;
  relevance_score?: number;
  page_number?: string;
  finding_id?: string;
  title?: string;
  severity?: string;
}

interface SimilarQuestion {
  question: string;
  similarity: number;
}

interface SourceAttribution {
  filename: string;
  pages: string;
  confidence: number;
  excerpt?: string;
  cited?: boolean;
  documentId?: string;
}

interface ConversationWithPreview extends QaConversation {
  messageCount: number;
  lastMessage: { role: string; content: string } | null;
}

interface AskResponse {
  answer: string;
  citations: Citation[];
  similar_past_questions: SimilarQuestion[];
  conversation_id: string;
  message_id: string;
  confidenceScore: number;
  sourceCount: number;
  sources: SourceAttribution[];
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#EF4444",
  HIGH: "#F97316",
  MEDIUM: "#F59E0B",
  LOW: "#10B981",
};

const SUGGESTED_QUESTIONS = [
  "What are the highest-priority cybersecurity risks?",
  "Estimate the total remediation cost across all findings.",
  "Which pillars need the most attention before close?",
  "Does the target have adequate disaster recovery?",
  "Are there any compliance gaps that could affect the deal timeline?",
  "Are there any vendor lock-in risks?",
];

function formatTimeAgo(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function groupConversationsByDate(conversations: ConversationWithPreview[]): Record<string, ConversationWithPreview[]> {
  const groups: Record<string, ConversationWithPreview[]> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  conversations.forEach(conv => {
    const d = new Date(conv.createdAt || "");
    let label: string;
    if (d >= today) label = "Today";
    else if (d >= yesterday) label = "Yesterday";
    else if (d >= weekAgo) label = "This Week";
    else label = "Older";
    if (!groups[label]) groups[label] = [];
    groups[label].push(conv);
  });
  return groups;
}

function CitationBadge({ citation }: { citation: Citation }) {
  if (citation.finding_id) {
    const color = SEVERITY_COLORS[citation.severity || ""] || "#6B7280";
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-data border"
        style={{ borderColor: `${color}40`, color, backgroundColor: `${color}10` }}
        data-testid={`citation-finding-${citation.finding_id}`}
      >
        <AlertTriangle className="w-2.5 h-2.5" />
        {citation.title?.slice(0, 40) || citation.finding_id}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-data border border-[#3B82F6]/30 text-[#3B82F6] bg-[#3B82F6]/10"
      data-testid={`citation-doc-${citation.document_id || "unknown"}`}
    >
      <FileText className="w-2.5 h-2.5" />
      {citation.document_name?.slice(0, 30) || "Document"}
      {citation.page_number && <span className="opacity-60">({citation.page_number})</span>}
    </span>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex items-start gap-3" data-testid="chat-message-user">
      <div className="w-7 h-7 rounded-md bg-[#3B82F6] flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-white text-[11px] font-bold">Q</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

interface MessageMetadata {
  similar?: SimilarQuestion[];
  confidenceScore?: number;
  sourceCount?: number;
  sources?: SourceAttribution[];
}

function extractMessageMeta(msg: QaMessage): MessageMetadata {
  const raw = msg.similarQuestionIds as any;
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "confidenceScore" in raw) {
    return raw as MessageMetadata;
  }
  if (Array.isArray(raw)) {
    return { similar: raw as SimilarQuestion[] };
  }
  return {};
}

function AssistantMessage({
  message,
  onSave,
  isSaving,
  onCopy,
  onSourcesChange,
}: {
  message: QaMessage;
  onSave: (messageId: string) => void;
  isSaving: boolean;
  onCopy: (text: string) => void;
  onSourcesChange?: (sources: SourceAttribution[]) => void;
}) {
  const [showSources, setShowSources] = useState(false);
  const citations = (message.citations as Citation[]) || [];
  const meta = extractMessageMeta(message);
  const confidenceScore = meta.confidenceScore;
  const sourceCount = meta.sourceCount;
  const similarQuestions = meta.similar || [];
  const docCitations = citations.filter(c => c.document_name);
  const findingCitations = citations.filter(c => c.finding_id);

  return (
    <div className="flex items-start gap-3" data-testid="chat-message-assistant">
      <div className="w-7 h-7 rounded-md bg-[#8B5CF6]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="bg-[var(--bg-panel)] rounded-md p-4 border border-[var(--theme-border)]/50">
          <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>

          {(confidenceScore !== undefined || sourceCount !== undefined) && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--theme-border)]/50 flex-wrap">
              {confidenceScore !== undefined && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                  <span className="font-data text-[10px] text-[#10B981]">
                    {Math.round(confidenceScore * 100)}%
                  </span>
                </div>
              )}
              {sourceCount !== undefined && sourceCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-[var(--text-disabled)]" />
                  <span className="font-data text-[10px] text-[var(--text-secondary)]">
                    {sourceCount} sources
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-[#8B5CF6]" />
                <span className="text-[10px] text-[#8B5CF6]">Verified</span>
              </div>
            </div>
          )}
        </div>

        {citations.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1.5 text-[10px] font-data text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              data-testid="button-toggle-sources"
            >
              <Eye className="w-3 h-3" />
              {citations.length} citation{citations.length !== 1 ? "s" : ""}
              {showSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <div className="flex flex-wrap gap-1.5">
              {docCitations.map((c, i) => <CitationBadge key={`doc-${i}`} citation={c} />)}
              {findingCitations.map((c, i) => <CitationBadge key={`finding-${i}`} citation={c} />)}
            </div>
            {showSources && (
              <div className="mt-2 space-y-2 border border-[var(--theme-border)]/30 rounded-md p-3 bg-[var(--bg-primary)]/50">
                {docCitations.map((c, i) => (
                  <div key={i} className="text-[11px] text-[var(--text-secondary)]">
                    <span className="text-[#3B82F6] font-data">{c.document_name}</span>
                    {c.page_number && <span className="text-[var(--text-disabled)]"> ({c.page_number})</span>}
                    {c.relevance_score && <span className="text-[var(--text-disabled)]"> — {(c.relevance_score * 100).toFixed(0)}% match</span>}
                    {c.chunk_text && (
                      <p className="mt-1 text-[var(--text-disabled)] italic leading-relaxed line-clamp-2">"{c.chunk_text}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {similarQuestions.length > 0 && (
          <div className="flex items-center gap-2 text-[10px] text-[#F59E0B]">
            <Clock className="w-3 h-3" />
            Similar: "{similarQuestions[0].question?.slice(0, 60)}" ({(similarQuestions[0].similarity * 100).toFixed(0)}% match)
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onSave(message.id)}
            disabled={isSaving}
            className="flex items-center gap-1 text-[10px] font-data text-[var(--text-disabled)] hover:text-[#10B981] transition-colors disabled:opacity-50"
            data-testid="button-save-answer"
          >
            <Bookmark className="w-3 h-3" />
            Save
          </button>
          <button
            onClick={() => onCopy(message.content)}
            className="flex items-center gap-1 text-[10px] font-data text-[var(--text-disabled)] hover:text-[var(--text-primary)] transition-colors"
            data-testid="button-copy-answer"
          >
            <Copy className="w-3 h-3" />
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3" data-testid="typing-indicator">
      <div className="w-7 h-7 rounded-md bg-[#8B5CF6]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6] animate-pulse" />
      </div>
      <div className="flex-1 space-y-2 pt-1">
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <Loader2 className="w-3 h-3 animate-spin" />
          Analyzing documents and findings...
        </div>
        <div className="space-y-1.5">
          <div className="h-3 bg-[var(--theme-border)]/20 rounded animate-pulse w-full" />
          <div className="h-3 bg-[var(--theme-border)]/20 rounded animate-pulse w-4/5" />
          <div className="h-3 bg-[var(--theme-border)]/20 rounded animate-pulse w-3/5" />
        </div>
      </div>
    </div>
  );
}

function SourceAttributionPanel({
  sources,
  documents,
  onPreviewDocument,
}: {
  sources: SourceAttribution[];
  documents?: Document[];
  onPreviewDocument?: (docId: string) => void;
}) {
  const findDocByFilename = (filename: string) => documents?.find((d) => d.filename === filename);

  return (
    <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-4" data-testid="source-panel">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-3.5 h-3.5 text-[#06B6D4]" />
        <h3 className="text-xs font-medium text-[var(--text-primary)]">Source Attribution</h3>
      </div>
      {sources.length > 0 ? (
        <div className="space-y-2">
          {sources.map((src, i) => {
            const matchedDoc = findDocByFilename(src.filename) || (src.documentId ? documents?.find(d => d.id === src.documentId) : undefined);
            return (
              <div
                key={i}
                className={`bg-[var(--bg-panel)] rounded-md p-2.5 border ${src.cited ? "border-[#8B5CF6]/30" : "border-[var(--theme-border)]/30"}`}
                data-testid={`source-doc-${i}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {matchedDoc && onPreviewDocument ? (
                    <button
                      onClick={() => onPreviewDocument(matchedDoc.id)}
                      className="text-[11px] text-[#3B82F6] font-medium truncate hover:underline text-left"
                      data-testid={`btn-source-preview-${i}`}
                    >
                      {src.filename}
                    </button>
                  ) : (
                    <p className="text-[11px] text-[#3B82F6] font-medium truncate">{src.filename}</p>
                  )}
                  {matchedDoc && onPreviewDocument && (
                    <button
                      onClick={() => onPreviewDocument(matchedDoc.id)}
                      className="p-0.5 rounded hover:bg-[var(--theme-border)]/30 flex-shrink-0"
                      data-testid={`btn-source-eye-${i}`}
                    >
                      <Eye className="w-3 h-3 text-[var(--text-disabled)]" />
                    </button>
                  )}
                </div>
                {src.excerpt && (
                  <p className="font-data text-[10px] text-[var(--text-secondary)] leading-relaxed mb-1.5 line-clamp-2">
                    {src.excerpt}
                  </p>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-data text-[10px] text-[var(--text-disabled)]">{src.pages}</span>
                  <Badge
                    variant="outline"
                    className="text-[9px] font-data border-[#10B981]/30 text-[#10B981] px-1 py-0 h-[16px] no-default-hover-elevate no-default-active-elevate"
                  >
                    {Math.round(src.confidence * 100)}%
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-[var(--text-disabled)] text-center py-4">
          Sources will appear after your first query
        </p>
      )}
    </Card>
  );
}

function ApiKeyMissing() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-8 flex flex-col items-center justify-center max-w-md">
        <div className="w-12 h-12 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6 text-[#F59E0B]" />
        </div>
        <h2 className="text-sm font-medium text-[var(--text-primary)] mb-2">AI Services Unavailable</h2>
        <p className="text-xs text-[var(--text-disabled)] text-center" data-testid="text-api-key-missing">
          AI services are not configured. Contact your platform administrator.
        </p>
      </Card>
    </div>
  );
}

export default function AskAiPage() {
  const { toast } = useToast();
  const [selectedDealId, setSelectedDealId] = useState<string>("");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [panelSources, setPanelSources] = useState<SourceAttribution[]>([]);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: deals } = useQuery<Deal[]>({ queryKey: ["/api/deals"] });

  const { data: aiStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/ai/status"],
  });

  useEffect(() => {
    if (deals?.length && !selectedDealId) {
      setSelectedDealId(deals[0].id);
    }
  }, [deals, selectedDealId]);

  const activeDeal = useMemo(() => deals?.find(d => d.id === selectedDealId), [deals, selectedDealId]);

  const { data: conversations, isLoading: convLoading } = useQuery<ConversationWithPreview[]>({
    queryKey: ["/api/deals", selectedDealId, "qa", "conversations"],
    enabled: !!selectedDealId,
  });

  const { data: activeMessages, isLoading: messagesLoading } = useQuery<{ messages: QaMessage[] }>({
    queryKey: ["/api/deals", selectedDealId, "qa", "conversations", activeConversationId],
    enabled: !!selectedDealId && !!activeConversationId,
  });

  const { data: documents } = useQuery<Document[]>({
    queryKey: ["/api/deals", selectedDealId, "documents"],
    enabled: !!selectedDealId,
  });

  const messages = activeMessages?.messages || [];

  const askMutation = useMutation({
    mutationFn: async ({ question, conversationId }: { question: string; conversationId: string | null }) => {
      const res = await apiRequest("POST", `/api/deals/${selectedDealId}/qa/ask`, {
        question,
        conversation_id: conversationId,
      });
      return res.json() as Promise<AskResponse>;
    },
    onSuccess: (data) => {
      setActiveConversationId(data.conversation_id);
      setPanelSources(data.sources || []);
      queryClient.invalidateQueries({ queryKey: ["/api/deals", selectedDealId, "qa", "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", selectedDealId, "qa", "conversations", data.conversation_id] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiRequest("POST", `/api/deals/${selectedDealId}/qa/save-answer`, { message_id: messageId });
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Answer saved for future reference" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (convId: string) => {
      await apiRequest("DELETE", `/api/deals/${selectedDealId}/qa/conversations/${convId}`);
    },
    onSuccess: (_data, convId) => {
      if (activeConversationId === convId) {
        setActiveConversationId(null);
        setPanelSources([]);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/deals", selectedDealId, "qa", "conversations"] });
    },
  });

  const handleSend = useCallback(() => {
    const q = inputValue.trim();
    if (!q || askMutation.isPending || !selectedDealId) return;
    setInputValue("");
    askMutation.mutate({ question: q, conversationId: activeConversationId });
  }, [inputValue, askMutation, selectedDealId, activeConversationId]);

  const handleSuggestedQuestion = useCallback((q: string) => {
    if (askMutation.isPending || !selectedDealId) return;
    setActiveConversationId(null);
    setPanelSources([]);
    askMutation.mutate({ question: q, conversationId: null });
  }, [askMutation, selectedDealId]);

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setPanelSources([]);
    inputRef.current?.focus();
  }, []);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  }, [toast]);

  const handleDealChange = useCallback((v: string) => {
    setSelectedDealId(v);
    setActiveConversationId(null);
    setPanelSources([]);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, askMutation.isPending]);

  useEffect(() => {
    if (messages.length > 0) {
      const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
      if (lastAssistant) {
        const meta = extractMessageMeta(lastAssistant);
        if (meta.sources && meta.sources.length > 0) {
          setPanelSources(meta.sources);
        }
      }
    }
  }, [messages]);

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c =>
      c.title?.toLowerCase().includes(q) ||
      c.lastMessage?.content.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const groupedConversations = useMemo(() => groupConversationsByDate(filteredConversations), [filteredConversations]);

  const isConfigured = aiStatus?.configured !== false;

  return (
    <div className="h-full flex flex-col animate-fade-in" data-testid="ask-ai-page">
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--theme-border)]/30">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-sm font-semibold text-[var(--text-primary)]" data-testid="text-ask-ai-title">
            Ask MERIDIAN
          </h1>
          <Badge
            variant="outline"
            className="text-[10px] font-data border-[#8B5CF6]/30 text-[#8B5CF6] px-1.5 py-0 h-[18px] no-default-hover-elevate no-default-active-elevate"
          >
            <Sparkles className="w-3 h-3 mr-1" />
            AI-Powered
          </Badge>
          {activeDeal && (
            <span className="text-[11px] text-[var(--text-disabled)]">
              Analyzing: {activeDeal.targetName}
            </span>
          )}
        </div>

        <Select value={selectedDealId} onValueChange={handleDealChange}>
          <SelectTrigger
            className="h-8 w-[220px] bg-[var(--bg-panel)] border-[var(--theme-border)] text-xs text-[var(--text-primary)]"
            data-testid="select-deal"
          >
            <SelectValue placeholder="Select a deal" />
          </SelectTrigger>
          <SelectContent className="bg-[var(--bg-card)] border-[var(--theme-border)]">
            {deals?.map((d) => (
              <SelectItem key={d.id} value={d.id} className="text-xs text-[var(--text-primary)]">
                {d.targetName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isConfigured ? (
        <ApiKeyMissing />
      ) : !selectedDealId ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--text-disabled)]">Select a deal to start asking questions</p>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-[260px] border-r border-[var(--theme-border)]/30 flex flex-col bg-[var(--bg-primary)] flex-shrink-0 hidden md:flex" data-testid="conversation-sidebar">
            <div className="p-3 space-y-2">
              <button
                onClick={handleNewConversation}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/20 transition-colors border border-[#3B82F6]/20"
                data-testid="button-new-conversation"
              >
                <Plus className="w-3.5 h-3.5" />
                New Conversation
              </button>
              <div className="flex items-center gap-2 bg-[var(--bg-panel)] rounded-md px-2.5 py-1.5 border border-[var(--theme-border)]/30">
                <Search className="w-3 h-3 text-[var(--text-disabled)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="bg-transparent text-[11px] text-[var(--text-primary)] placeholder-[var(--text-disabled)] outline-none w-full font-data"
                  data-testid="input-search-conversations"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {convLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 text-[var(--text-disabled)] animate-spin" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <p className="text-[11px] text-[var(--text-disabled)] text-center py-6">No conversations yet</p>
              ) : (
                Object.entries(groupedConversations).map(([label, convs]) => (
                  <div key={label} className="mb-3">
                    <p className="text-[9px] font-data text-[var(--text-disabled)] uppercase tracking-wider px-2 mb-1">{label}</p>
                    {convs.map(conv => (
                      <div
                        key={conv.id}
                        onClick={() => setActiveConversationId(conv.id)}
                        className={`group flex items-start gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors ${
                          activeConversationId === conv.id
                            ? "bg-[#3B82F6]/10 border border-[#3B82F6]/20"
                            : "hover:bg-[var(--bg-panel)] border border-transparent"
                        }`}
                        data-testid={`conversation-item-${conv.id}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[var(--text-disabled)] flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-[var(--text-primary)] truncate">{conv.title || "Untitled"}</p>
                          <p className="text-[10px] text-[var(--text-disabled)] truncate mt-0.5">
                            {conv.lastMessage?.content?.slice(0, 60) || "No messages"}
                          </p>
                          <p className="text-[9px] text-[var(--text-disabled)] font-data mt-0.5">
                            {formatTimeAgo(conv.updatedAt)} · {conv.messageCount} msg{conv.messageCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(conv.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-disabled)] hover:text-[#EF4444] transition-all"
                          data-testid={`button-delete-conv-${conv.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0" data-testid="chat-area">
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {!activeConversationId && messages.length === 0 && !askMutation.isPending ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center mb-4">
                    <Sparkles className="w-6 h-6 text-[#8B5CF6]" />
                  </div>
                  <h2 className="text-sm font-medium text-[var(--text-primary)] mb-2">
                    How can I help with {activeDeal?.targetName || "this deal"}?
                  </h2>
                  <p className="text-xs text-[var(--text-disabled)] max-w-sm mb-6">
                    Ask questions about deal data, risk assessments, integration timelines, and more. All responses include source citations.
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
                    {SUGGESTED_QUESTIONS.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestedQuestion(q)}
                        className="text-left px-3 py-2.5 rounded-md border border-[var(--theme-border)]/30 bg-[var(--bg-panel)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#3B82F6]/30 hover:bg-[#3B82F6]/5 transition-colors"
                        data-testid={`suggested-question-${i}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messagesLoading && activeConversationId ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 text-[var(--text-disabled)] animate-spin" />
                    </div>
                  ) : (
                    messages.map((msg) =>
                      msg.role === "user" ? (
                        <UserMessage key={msg.id} content={msg.content} />
                      ) : (
                        <AssistantMessage
                          key={msg.id}
                          message={msg}
                          onSave={(id) => saveMutation.mutate(id)}
                          isSaving={saveMutation.isPending}
                          onCopy={handleCopy}
                        />
                      )
                    )
                  )}
                  {askMutation.isPending && <TypingIndicator />}
                  <div ref={chatEndRef} />
                </>
              )}
            </div>

            <div className="border-t border-[var(--theme-border)]/30 p-3">
              <div className="flex items-end gap-2 bg-[var(--bg-panel)] rounded-lg border border-[var(--theme-border)]/30 px-3 py-2 focus-within:border-[#3B82F6]/50 transition-colors">
                <Sparkles className="w-4 h-4 text-[var(--text-disabled)] flex-shrink-0 mb-0.5" />
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask a question about this deal..."
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-disabled)] outline-none resize-none max-h-32 font-data"
                  style={{ minHeight: "24px" }}
                  disabled={askMutation.isPending}
                  data-testid="input-ai-chat"
                />
                <button
                  onClick={handleSend}
                  disabled={askMutation.isPending || !inputValue.trim()}
                  className="w-8 h-8 rounded-md bg-[#3B82F6] flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex-shrink-0"
                  data-testid="button-ai-send"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>

          <div className="w-[300px] flex-shrink-0 p-4 overflow-y-auto hidden lg:block border-l border-[var(--theme-border)]/30">
            <SourceAttributionPanel
              sources={panelSources}
              documents={documents}
              onPreviewDocument={setPreviewDocId}
            />
          </div>
        </div>
      )}

      {previewDocId && (
        <DocumentPreview
          documentId={previewDocId}
          onClose={() => setPreviewDocId(null)}
          defaultTab="preview"
          dealDocuments={documents?.map((d) => ({ id: d.id, filename: d.filename }))}
        />
      )}
    </div>
  );
}
