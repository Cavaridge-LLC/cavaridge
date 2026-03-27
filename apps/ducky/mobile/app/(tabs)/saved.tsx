/**
 * Saved Tab — View saved research answers
 *
 * Lists saved answers from GET /api/saved-answers.
 * Supports delete with swipe-to-reveal or long-press.
 */

import { useContext, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { ThemeContext } from "@/components/theme-context";
import { DuckyAvatar } from "@/components/ducky-avatar";
import { apiGet, apiDelete, BRANDING } from "@/utils/api";

interface SavedAnswer {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  createdAt: string;
}

export default function SavedScreen() {
  const { c } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();

  const [answers, setAnswers] = useState<SavedAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSaved = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const data = await apiGet<SavedAnswer[]>("/api/saved-answers");
      setAnswers(data);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "Failed to load saved answers";
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSaved();
    }, [fetchSaved])
  );

  const handleDelete = useCallback(
    (item: SavedAnswer) => {
      Alert.alert(
        "Delete Saved Answer",
        `Remove "${item.question.slice(0, 60)}..."?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await apiDelete(`/api/saved-answers/${item.id}`);
                setAnswers((prev) => prev.filter((a) => a.id !== item.id));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch {
                Alert.alert("Error", "Failed to delete saved answer.");
              }
            },
          },
        ]
      );
    },
    []
  );

  const renderAnswerCard = ({ item }: { item: SavedAnswer }) => {
    const isExpanded = expandedId === item.id;
    const previewLength = 150;
    const needsTruncation = item.answer.length > previewLength;

    return (
      <Pressable
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        onLongPress={() => handleDelete(item)}
        style={{
          backgroundColor: c.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c.border,
          padding: 16,
          marginHorizontal: 16,
          marginBottom: 10,
        }}
      >
        {/* Question */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <Ionicons name="help-circle" size={18} color={c.primary} style={{ marginTop: 1 }} />
          <Text
            style={{
              flex: 1,
              fontSize: 15,
              fontWeight: "600",
              color: c.text,
              lineHeight: 20,
            }}
          >
            {item.question}
          </Text>
        </View>

        {/* Answer preview / full */}
        <Text
          style={{
            fontSize: 14,
            color: c.textSecondary,
            lineHeight: 20,
            marginTop: 10,
            marginLeft: 26,
          }}
          numberOfLines={isExpanded ? undefined : 4}
        >
          {isExpanded ? item.answer : item.answer.slice(0, previewLength)}
          {!isExpanded && needsTruncation ? "..." : ""}
        </Text>

        {needsTruncation && (
          <Text
            style={{
              fontSize: 12,
              color: c.primary,
              fontWeight: "600",
              marginTop: 6,
              marginLeft: 26,
            }}
          >
            {isExpanded ? "Show less" : "Show more"}
          </Text>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 10,
              marginLeft: 26,
            }}
          >
            {item.tags.map((tag, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: c.primaryLight,
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ fontSize: 11, color: c.primary, fontWeight: "500" }}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer: date + delete */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 10,
            marginLeft: 26,
          }}
        >
          <Text style={{ fontSize: 11, color: c.textMuted }}>
            Saved {new Date(item.createdAt).toLocaleDateString()}
          </Text>
          <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
            <Ionicons name="trash-outline" size={16} color={c.textMuted} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

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
      <Text style={{ fontSize: 18, fontWeight: "700", color: c.text, marginTop: 20 }}>
        No saved answers yet
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: c.textSecondary,
          textAlign: "center",
          marginTop: 8,
          lineHeight: 20,
        }}
      >
        When you find a great answer from Ducky, save it for quick reference.
        Saved answers appear here.
      </Text>
    </View>
  );

  if (isLoading && answers.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: c.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={c.primary} />
        <Text style={{ fontSize: 14, color: c.textSecondary, marginTop: 12 }}>
          Loading saved answers...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: c.card,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        <Text style={{ fontSize: 28, fontWeight: "800", color: c.text }}>
          Saved
        </Text>
        <Text style={{ fontSize: 13, color: c.textSecondary, marginTop: 4 }}>
          {answers.length} saved answer{answers.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Error banner */}
      {error && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.errorBg,
            paddingHorizontal: 16,
            paddingVertical: 10,
            gap: 8,
          }}
        >
          <Ionicons name="alert-circle" size={16} color={c.error} />
          <Text style={{ flex: 1, fontSize: 13, color: c.error }}>{error}</Text>
          <Pressable onPress={() => fetchSaved()}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: c.primary }}>
              Retry
            </Text>
          </Pressable>
        </View>
      )}

      {answers.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={answers}
          keyExtractor={(item) => item.id}
          renderItem={renderAnswerCard}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchSaved(true)}
              tintColor={c.primary}
              colors={[c.primary]}
            />
          }
        />
      )}

      {/* Footer */}
      <View
        style={{
          paddingVertical: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          alignItems: "center",
          borderTopWidth: 1,
          borderTopColor: c.border,
          backgroundColor: c.card,
        }}
      >
        <Text style={{ fontSize: 10, color: c.textMuted }}>{BRANDING.duckyFooter}</Text>
      </View>
    </View>
  );
}
