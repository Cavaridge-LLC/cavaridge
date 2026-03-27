/**
 * Chat message bubble — role-based styling.
 *
 * User messages: right-aligned, primary blue background.
 * Ducky messages: left-aligned with avatar, muted card background.
 * Supports basic markdown-like formatting (bold, code blocks, bullet lists).
 */

import { View, Text, Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { DuckyAvatar, type DuckyState } from "./ducky-avatar";
import type { ThemeColors } from "@/utils/theme";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  sources?: Array<{ name: string; type: string; score: number }>;
}

interface ChatBubbleProps {
  message: ChatMessage;
  colors: ThemeColors;
  duckyState?: DuckyState;
  isLatest?: boolean;
}

/** Basic markdown-like text rendering. Splits bold, inline code, and code blocks. */
function FormattedText({ text, color, fontSize }: { text: string; color: string; fontSize: number }) {
  // Split on code blocks first
  const codeBlockRegex = /```[\s\S]*?```/g;
  const segments: Array<{ type: "text" | "codeblock"; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    // Strip the ``` markers
    const code = match[0].replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    segments.push({ type: "codeblock", value: code });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return (
    <Text>
      {segments.map((seg, i) => {
        if (seg.type === "codeblock") {
          return (
            <Text
              key={i}
              style={{
                fontFamily: "monospace",
                fontSize: fontSize - 1,
                backgroundColor: "rgba(0,0,0,0.08)",
                color,
              }}
            >
              {"\n"}{seg.value}{"\n"}
            </Text>
          );
        }

        // Process inline formatting: **bold**, `code`, bullet points
        const parts = seg.value.split(/(\*\*.*?\*\*|`[^`]+`)/g);
        return parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <Text key={`${i}-${j}`} style={{ fontWeight: "700", color, fontSize }}>
                {part.slice(2, -2)}
              </Text>
            );
          }
          if (part.startsWith("`") && part.endsWith("`")) {
            return (
              <Text
                key={`${i}-${j}`}
                style={{
                  fontFamily: "monospace",
                  fontSize: fontSize - 1,
                  backgroundColor: "rgba(0,0,0,0.06)",
                  color,
                }}
              >
                {part.slice(1, -1)}
              </Text>
            );
          }
          return (
            <Text key={`${i}-${j}`} style={{ color, fontSize, lineHeight: fontSize * 1.5 }}>
              {part}
            </Text>
          );
        });
      })}
    </Text>
  );
}

export function ChatBubble({ message, colors: c, duckyState, isLatest }: ChatBubbleProps) {
  const isUser = message.role === "user";

  const handleCopy = async () => {
    await Clipboard.setStringAsync(message.content);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: isUser ? "flex-end" : "flex-start",
        alignItems: "flex-end",
        marginBottom: 12,
        paddingHorizontal: 12,
        gap: 8,
      }}
    >
      {/* Ducky avatar on left for assistant messages */}
      {!isUser && (
        <View style={{ marginBottom: 4 }}>
          <DuckyAvatar state={duckyState || (isLatest ? "presenting" : "idle")} size="sm" />
        </View>
      )}

      <View
        style={{
          maxWidth: "78%",
          backgroundColor: isUser ? c.userBubble : c.assistantBubble,
          borderRadius: 18,
          borderBottomRightRadius: isUser ? 4 : 18,
          borderBottomLeftRadius: isUser ? 18 : 4,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <FormattedText
          text={message.content}
          color={isUser ? c.userBubbleText : c.assistantBubbleText}
          fontSize={15}
        />

        {/* Sources attribution */}
        {message.sources && message.sources.length > 0 && (
          <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.08)" }}>
            <Text style={{ fontSize: 11, color: isUser ? "rgba(255,255,255,0.6)" : c.textMuted, fontWeight: "600" }}>
              Sources:
            </Text>
            {message.sources.map((src, i) => (
              <Text
                key={i}
                style={{ fontSize: 11, color: isUser ? "rgba(255,255,255,0.5)" : c.textMuted, marginTop: 2 }}
              >
                {src.name} ({src.type})
              </Text>
            ))}
          </View>
        )}

        {/* Copy + timestamp row */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 6,
          }}
        >
          {message.createdAt && (
            <Text
              style={{
                fontSize: 10,
                color: isUser ? "rgba(255,255,255,0.45)" : c.textMuted,
              }}
            >
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          )}

          {!isUser && (
            <Pressable
              onPress={handleCopy}
              hitSlop={8}
              style={{ marginLeft: 8, padding: 2 }}
            >
              <Ionicons name="copy-outline" size={13} color={c.textMuted} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
