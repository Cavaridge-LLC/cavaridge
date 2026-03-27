/**
 * Knowledge Tab — Browse knowledge sources
 *
 * Lists knowledge sources from GET /api/knowledge.
 * Shows source name, type, chunk count, and active status.
 */

import { useContext, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { ThemeContext } from "@/components/theme-context";
import { DuckyAvatar } from "@/components/ducky-avatar";
import { apiGet, BRANDING } from "@/utils/api";

interface KnowledgeSource {
  id: string;
  name: string;
  sourceType: string;
  isActive: boolean;
  chunkCount: number;
  createdAt: string;
  metadataJson?: Record<string, unknown>;
}

const SOURCE_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  document: "document-text",
  url: "globe",
  text: "create",
  pdf: "document",
  api: "code-slash",
};

export default function KnowledgeScreen() {
  const { c } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();

  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSources = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const data = await apiGet<KnowledgeSource[]>("/api/knowledge");
      setSources(data);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "Failed to load knowledge sources";
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSources();
    }, [fetchSources])
  );

  const renderSourceCard = ({ item }: { item: KnowledgeSource }) => {
    const icon = SOURCE_TYPE_ICONS[item.sourceType] || "document";
    const typeLabel = item.sourceType.charAt(0).toUpperCase() + item.sourceType.slice(1);

    return (
      <View
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: item.isActive ? c.primaryLight : c.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={icon as any}
              size={20}
              color={item.isActive ? c.primary : c.textMuted}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 15, fontWeight: "600", color: c.text }}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 }}>
              <Text style={{ fontSize: 12, color: c.textSecondary }}>
                {typeLabel}
              </Text>
              <Text style={{ fontSize: 10, color: c.textMuted }}>|</Text>
              <Text style={{ fontSize: 12, color: c.textSecondary }}>
                {item.chunkCount} chunk{item.chunkCount !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: item.isActive ? c.successBg : c.accent,
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: item.isActive ? c.success : c.textMuted,
              }}
            >
              {item.isActive ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 8 }}>
          Added {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
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
      <DuckyAvatar state="searching" size="xl" />
      <Text style={{ fontSize: 18, fontWeight: "700", color: c.text, marginTop: 20 }}>
        No knowledge sources yet
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
        Add documents, URLs, or text content to Ducky's knowledge base from the
        web dashboard. They'll appear here for browsing.
      </Text>
    </View>
  );

  if (isLoading && sources.length === 0) {
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
          Loading knowledge base...
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
          Knowledge
        </Text>
        <Text style={{ fontSize: 13, color: c.textSecondary, marginTop: 4 }}>
          {sources.length} source{sources.length !== 1 ? "s" : ""} in your knowledge base
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
          <Pressable onPress={() => fetchSources()}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: c.primary }}>
              Retry
            </Text>
          </Pressable>
        </View>
      )}

      {sources.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={sources}
          keyExtractor={(item) => item.id}
          renderItem={renderSourceCard}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchSources(true)}
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
