/**
 * Ask Tab — Ducky Intelligence Chat Interface
 *
 * The hero feature. Full chat UI for asking Ducky research questions.
 * - Message bubbles (user right-aligned blue, Ducky left-aligned with avatar)
 * - Keyboard-aware scroll with auto-scroll to bottom
 * - Pull-to-refresh for conversation history
 * - Loading indicator with "Ducky is thinking..." animation
 * - Error handling with retry
 * - Empty state with Ducky greeting
 */

import { useContext, useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemeContext } from "@/components/theme-context";
import { ChatBubble, type ChatMessage } from "@/components/chat-bubble";
import { DuckyAvatar } from "@/components/ducky-avatar";
import { apiPost, apiGet, BRANDING } from "@/utils/api";

interface AskResponse {
  conversationId: string;
  message: {
    id: string;
    role: "assistant";
    content: string;
    createdAt: string;
    sourcesJson?: Array<{ name: string; type: string; score: number }>;
    latencyMs?: number;
  };
  sources: Array<{ name: string; type: string; score: number }>;
}

interface ConversationListItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export default function AskScreen() {
  const { c } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  /** Scroll to bottom of message list. */
  const scrollToBottom = useCallback(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  /** Send a question to the Ducky API. */
  const sendQuestion = useCallback(
    async (question: string) => {
      if (!question.trim() || isLoading) return;

      setError(null);
      setLastFailedQuestion(null);

      // Add user message to list immediately
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: question.trim(),
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInputText("");
      setIsLoading(true);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        const response = await apiPost<AskResponse>("/api/ask", {
          question: question.trim(),
          conversationId: conversationId || undefined,
        });

        if (!conversationId && response.conversationId) {
          setConversationId(response.conversationId);
        }

        const assistantMessage: ChatMessage = {
          id: response.message.id,
          role: "assistant",
          content: response.message.content,
          createdAt: response.message.createdAt,
          sources: response.sources,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err: unknown) {
        const errorMessage =
          err && typeof err === "object" && "message" in err
            ? (err as { message: string }).message
            : "Failed to get a response. Check your connection and try again.";
        setError(errorMessage);
        setLastFailedQuestion(question.trim());
        // Remove the user message on error so they can retry
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, isLoading]
  );

  /** Pull-to-refresh: reload conversation messages from server. */
  const handleRefresh = useCallback(async () => {
    if (!conversationId) {
      setIsRefreshing(false);
      return;
    }
    setIsRefreshing(true);
    try {
      const serverMessages = await apiGet<
        Array<{
          id: string;
          role: "user" | "assistant";
          content: string;
          createdAt: string;
          sourcesJson?: Array<{ name: string; type: string; score: number }>;
        }>
      >(`/api/conversations/${conversationId}/messages`);

      setMessages(
        serverMessages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          sources: m.sourcesJson,
        }))
      );
    } catch {
      // Silently fail on refresh — keep existing messages
    } finally {
      setIsRefreshing(false);
    }
  }, [conversationId]);

  /** Start a new conversation. */
  const handleNewConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setLastFailedQuestion(null);
    inputRef.current?.focus();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  /** Retry the last failed question. */
  const handleRetry = useCallback(() => {
    if (lastFailedQuestion) {
      sendQuestion(lastFailedQuestion);
    }
  }, [lastFailedQuestion, sendQuestion]);

  const handleSend = useCallback(() => {
    sendQuestion(inputText);
  }, [inputText, sendQuestion]);

  /** Render empty state with Ducky greeting. */
  const renderEmptyState = () => (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 40,
        paddingBottom: 80,
      }}
    >
      <DuckyAvatar state="idle" size="xl" />
      <Text
        style={{
          fontSize: 22,
          fontWeight: "800",
          color: c.text,
          marginTop: 20,
          textAlign: "center",
        }}
      >
        Hey there!
      </Text>
      <Text
        style={{
          fontSize: 15,
          color: c.textSecondary,
          textAlign: "center",
          marginTop: 8,
          lineHeight: 22,
        }}
      >
        I'm Ducky, your AI research assistant. Ask me anything — I'll search your
        knowledge base and the web to give you sourced, accurate answers.
      </Text>

      {/* Quick-start suggestions */}
      <View style={{ marginTop: 28, gap: 10, width: "100%" }}>
        {[
          "What are the latest HIPAA requirements for 2026?",
          "Compare NinjaOne vs ConnectWise for MSP RMM",
          "Summarize NIST CSF 2.0 key changes",
        ].map((suggestion, i) => (
          <Pressable
            key={i}
            onPress={() => sendQuestion(suggestion)}
            style={{
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 12,
              padding: 14,
            }}
          >
            <Text style={{ fontSize: 14, color: c.primary, fontWeight: "500" }}>
              {suggestion}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  /** Render the thinking indicator. */
  const renderThinkingIndicator = () => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 10,
      }}
    >
      <DuckyAvatar state="thinking" size="sm" />
      <View
        style={{
          backgroundColor: c.assistantBubble,
          borderRadius: 18,
          borderBottomLeftRadius: 4,
          paddingHorizontal: 16,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <ActivityIndicator size="small" color={c.duckyGold} />
        <Text style={{ fontSize: 14, color: c.textSecondary, fontStyle: "italic" }}>
          Ducky is thinking...
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: c.card,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <DuckyAvatar state={isLoading ? "thinking" : "idle"} size="md" />
          <View>
            <Text style={{ fontSize: 17, fontWeight: "700", color: c.text }}>
              {BRANDING.appName}
            </Text>
            <Text style={{ fontSize: 11, color: c.textMuted }}>
              {conversationId ? "Conversation active" : "New conversation"}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleNewConversation}
          hitSlop={8}
          style={{
            backgroundColor: c.accent,
            borderRadius: 8,
            padding: 8,
          }}
        >
          <Ionicons name="add" size={20} color={c.primary} />
        </Pressable>
      </View>

      {/* Messages or empty state */}
      {messages.length === 0 && !isLoading ? (
        renderEmptyState()
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ChatBubble
              message={item}
              colors={c}
              isLatest={index === messages.length - 1 && item.role === "assistant"}
            />
          )}
          contentContainerStyle={{
            paddingTop: 12,
            paddingBottom: 8,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={c.primary}
              colors={[c.primary]}
            />
          }
          onContentSizeChange={scrollToBottom}
          ListFooterComponent={isLoading ? renderThinkingIndicator : null}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Error banner with retry */}
      {error && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.errorBg,
            borderTopWidth: 1,
            borderTopColor: c.errorBorder,
            paddingHorizontal: 16,
            paddingVertical: 10,
            gap: 10,
          }}
        >
          <Ionicons name="alert-circle" size={18} color={c.error} />
          <Text style={{ flex: 1, fontSize: 13, color: c.error }} numberOfLines={2}>
            {error}
          </Text>
          {lastFailedQuestion && (
            <Pressable
              onPress={handleRetry}
              style={{
                backgroundColor: c.error,
                borderRadius: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#ffffff" }}>
                Retry
              </Text>
            </Pressable>
          )}
          <Pressable onPress={() => setError(null)} hitSlop={8}>
            <Ionicons name="close" size={18} color={c.error} />
          </Pressable>
        </View>
      )}

      {/* Input bar */}
      <View
        style={{
          backgroundColor: c.card,
          borderTopWidth: 1,
          borderTopColor: c.border,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 10),
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: c.inputBg,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: c.inputBorder,
              paddingHorizontal: 16,
              paddingVertical: Platform.OS === "ios" ? 10 : 6,
              maxHeight: 120,
            }}
          >
            <TextInput
              ref={inputRef}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask Ducky anything..."
              placeholderTextColor={c.textMuted}
              multiline
              maxLength={4000}
              style={{
                fontSize: 15,
                color: c.text,
                maxHeight: 100,
              }}
              editable={!isLoading}
              returnKeyType="default"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
          </View>

          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: inputText.trim() && !isLoading ? c.primary : c.accent,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 1,
            }}
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={
                inputText.trim() && !isLoading ? c.primaryForeground : c.textMuted
              }
            />
          </Pressable>
        </View>

        <Text
          style={{
            fontSize: 10,
            color: c.textMuted,
            textAlign: "center",
            marginTop: 6,
          }}
        >
          {BRANDING.duckyFooter}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
