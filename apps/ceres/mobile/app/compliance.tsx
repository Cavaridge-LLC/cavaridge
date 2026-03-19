/**
 * CMS Compliance Guidance Screen
 *
 * Provides access to the CMS/Medicare Domain Agent (Layer 1) for:
 * - Regulation lookup (42 CFR, LCDs, NCDs, CMS guidance)
 * - Compliance guidance for visit schedules
 * - LCD/NCD reference search
 *
 * These calls route through Ducky -> Spaniel per architecture spec.
 * The core calculator remains deterministic (no LLM dependency).
 */

import { useState, useContext } from "react";
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "@/components/theme-context";
import { DuckyMascot } from "@/components/ducky-mascot";
import { API_BASE_URL, BRANDING } from "@/utils/config";

type QueryType = "regulation" | "compliance" | "lcd_ncd";

export default function ComplianceScreen() {
  const { c } = useContext(ThemeContext);
  const [queryType, setQueryType] = useState<QueryType>("regulation");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const queryTypes: { id: QueryType; label: string; icon: keyof typeof Ionicons.glyphMap; placeholder: string }[] = [
    { id: "regulation", label: "Regulation", icon: "book", placeholder: "e.g., 60-day episode certification requirements" },
    { id: "compliance", label: "Compliance", icon: "shield-checkmark", placeholder: "Enter SOC date and visits..." },
    { id: "lcd_ncd", label: "LCD/NCD", icon: "document-text", placeholder: "e.g., skilled nursing home health" },
  ];

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let endpoint = "";
      let body: any = {};

      if (queryType === "regulation") {
        endpoint = "/api/cms/regulation-lookup";
        body = { query };
      } else if (queryType === "lcd_ncd") {
        endpoint = `/api/cms/lcd-ncd?query=${encodeURIComponent(query)}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: queryType === "lcd_ncd" ? "GET" : "POST",
        headers: { "Content-Type": "application/json" },
        ...(queryType !== "lcd_ncd" && { body: JSON.stringify(body) }),
      });

      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const activeType = queryTypes.find((t) => t.id === queryType)!;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingBottom: 40 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 60 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              backgroundColor: c.primaryLight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="medkit" size={26} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: "800", color: c.text }}>
              CMS Guidance
            </Text>
            <Text style={{ fontSize: 13, color: c.textSecondary }}>
              Medicare regulation & compliance lookup
            </Text>
          </View>
          <DuckyMascot state={loading ? "searching" : "idle"} size="sm" colors={c} />
        </View>

        {/* Query type selector */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: c.accent,
            borderRadius: 10,
            padding: 4,
            marginBottom: 16,
          }}
        >
          {queryTypes.map((type) => (
            <Pressable
              key={type.id}
              onPress={() => setQueryType(type.id)}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: queryType === type.id ? c.primary : "transparent",
              }}
            >
              <Ionicons
                name={type.icon as any}
                size={16}
                color={queryType === type.id ? c.primaryForeground : c.textSecondary}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: queryType === type.id ? c.primaryForeground : c.textSecondary,
                }}
              >
                {type.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Search input */}
        <View style={{ marginBottom: 16 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={activeType.placeholder}
            placeholderTextColor={c.textMuted}
            multiline
            style={{
              backgroundColor: c.card,
              borderRadius: 12,
              padding: 16,
              fontSize: 15,
              color: c.text,
              borderWidth: 1,
              borderColor: c.border,
              minHeight: 80,
              textAlignVertical: "top",
            }}
          />
        </View>

        <Pressable
          onPress={handleSearch}
          disabled={loading || !query.trim()}
          style={{
            backgroundColor: loading || !query.trim() ? c.accent : c.primary,
            borderRadius: 10,
            paddingVertical: 14,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
            marginBottom: 24,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={c.primaryForeground} />
          ) : (
            <Ionicons name="search" size={18} color={!query.trim() ? c.textMuted : c.primaryForeground} />
          )}
          <Text
            style={{
              color: !query.trim() ? c.textMuted : c.primaryForeground,
              fontWeight: "700",
              fontSize: 15,
            }}
          >
            {loading ? "Searching..." : "Search"}
          </Text>
        </Pressable>

        {/* Error */}
        {error && (
          <View
            style={{
              backgroundColor: c.errorBg,
              borderWidth: 1,
              borderColor: c.errorBorder,
              borderRadius: 10,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <Ionicons name="alert-circle" size={18} color={c.error} />
            <Text style={{ fontSize: 13, color: c.error, flex: 1 }}>{error}</Text>
          </View>
        )}

        {/* Results */}
        {result && (
          <View
            style={{
              backgroundColor: c.card,
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <DuckyMascot state="presenting" size="sm" colors={c} />
              <Text style={{ fontSize: 16, fontWeight: "700", color: c.text }}>Results</Text>
            </View>

            {result.answer && (
              <Text style={{ fontSize: 14, color: c.text, lineHeight: 22, marginBottom: 12 }}>
                {result.answer}
              </Text>
            )}

            {result.citations?.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: c.textSecondary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Citations
                </Text>
                {result.citations.map((cite: any, i: number) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
                    <Ionicons name="link" size={12} color={c.primary} style={{ marginTop: 3 }} />
                    <Text style={{ fontSize: 13, color: c.primary, flex: 1 }}>
                      {cite.source}{cite.title ? ` — ${cite.title}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {result.documents?.length > 0 && (
              <View>
                <Text style={{ fontSize: 12, fontWeight: "700", color: c.textSecondary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Documents
                </Text>
                {result.documents.map((doc: any, i: number) => (
                  <View key={i} style={{ backgroundColor: c.accent, borderRadius: 8, padding: 12, marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: c.text }}>
                      [{doc.type}] {doc.number} — {doc.title}
                    </Text>
                    {doc.summary && (
                      <Text style={{ fontSize: 12, color: c.textSecondary, marginTop: 4 }}>
                        {doc.summary}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {result.confidence && (
              <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 11, color: c.textMuted }}>Confidence:</Text>
                <View
                  style={{
                    backgroundColor: result.confidence === "high" ? c.successBg : result.confidence === "medium" ? c.warningBg : c.errorBg,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: result.confidence === "high" ? c.success : result.confidence === "medium" ? c.warning : c.error,
                    }}
                  >
                    {result.confidence}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={{ marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderTopColor: c.border, alignItems: "center", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <DuckyMascot state="idle" size="sm" colors={c} />
            <Text style={{ fontSize: 13, fontWeight: "500", color: c.textSecondary }}>
              {BRANDING.duckyFooter}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: c.textMuted }}>
            © {new Date().getFullYear()} {BRANDING.parentCompany}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
