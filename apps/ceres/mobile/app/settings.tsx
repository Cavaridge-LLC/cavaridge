/**
 * Settings & About Screen
 *
 * Theme selection (light/dark/system), app info, and Ducky Intelligence branding.
 */

import { useContext, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "@/components/theme-context";
import { DuckyMascot } from "@/components/ducky-mascot";
import { BRANDING } from "@/utils/config";

type ThemeOption = "light" | "dark" | "system";

export default function SettingsScreen() {
  const { isDark, c, toggle } = useContext(ThemeContext);
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption>("system");

  const themeOptions: { id: ThemeOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: "light", label: "Light", icon: "sunny" },
    { id: "dark", label: "Dark", icon: "moon" },
    { id: "system", label: "System", icon: "phone-portrait" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingBottom: 40 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 60 }}>
        {/* Header */}
        <Text style={{ fontSize: 28, fontWeight: "800", color: c.text, marginBottom: 24 }}>
          Settings
        </Text>

        {/* Theme Selection */}
        <View style={{ backgroundColor: c.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: c.border, marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 12 }}>
            Appearance
          </Text>
          <View style={{ gap: 8 }}>
            {themeOptions.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => {
                  setSelectedTheme(option.id);
                  // Toggle theme through context
                  if ((option.id === "dark" && !isDark) || (option.id === "light" && isDark)) {
                    toggle();
                  }
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  borderRadius: 10,
                  backgroundColor: selectedTheme === option.id ? c.primaryLight : c.accent,
                  borderWidth: 1,
                  borderColor: selectedTheme === option.id ? c.primary + "40" : c.border,
                }}
              >
                <Ionicons
                  name={option.icon as any}
                  size={20}
                  color={selectedTheme === option.id ? c.primary : c.textSecondary}
                />
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: selectedTheme === option.id ? c.primary : c.text,
                    flex: 1,
                  }}
                >
                  {option.label}
                </Text>
                {selectedTheme === option.id && (
                  <Ionicons name="checkmark-circle" size={20} color={c.primary} />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* About */}
        <View style={{ backgroundColor: c.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: c.border, marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 16 }}>
            About
          </Text>

          <View style={{ alignItems: "center", gap: 12, marginBottom: 16 }}>
            <DuckyMascot state="idle" size="lg" colors={c} />
            <Text style={{ fontSize: 20, fontWeight: "800", color: c.text }}>
              {BRANDING.appName}
            </Text>
            <Text style={{ fontSize: 14, color: c.textSecondary, textAlign: "center" }}>
              {BRANDING.appDescription}
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            <InfoRow label="Version" value="1.0.0" c={c} />
            <InfoRow label="Platform" value={BRANDING.parentCompany} c={c} />
            <InfoRow label="AI Engine" value={BRANDING.duckyIntelligence} c={c} />
            <InfoRow label="Calculator" value="Deterministic (no LLM)" c={c} />
            <InfoRow label="Compliance" value="CMS CY 2026 Guidelines" c={c} />
          </View>
        </View>

        {/* Regulatory Info */}
        <View style={{ backgroundColor: c.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: c.border, marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 12 }}>
            Regulatory Reference
          </Text>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <Ionicons name="shield-checkmark" size={16} color={c.primary} style={{ marginTop: 2 }} />
              <Text style={{ fontSize: 13, color: c.textSecondary, flex: 1 }}>
                60-day certification period per 42 CFR §424.22
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <Ionicons name="shield-checkmark" size={16} color={c.primary} style={{ marginTop: 2 }} />
              <Text style={{ fontSize: 13, color: c.textSecondary, flex: 1 }}>
                PDGM 30-day payment periods per CMS Final Rule CY 2020
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <Ionicons name="shield-checkmark" size={16} color={c.primary} style={{ marginTop: 2 }} />
              <Text style={{ fontSize: 13, color: c.textSecondary, flex: 1 }}>
                Sun-Sat week boundaries per CMS HH PPS guidelines
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={{ marginTop: 16, paddingTop: 20, borderTopWidth: 1, borderTopColor: c.border, alignItems: "center", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <DuckyMascot state="idle" size="sm" colors={c} />
            <Text style={{ fontSize: 13, fontWeight: "500", color: c.textSecondary }}>
              {BRANDING.duckyFooter}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: c.textMuted }}>
            © {new Date().getFullYear()} {BRANDING.parentCompany}. All rights reserved.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value, c }: { label: string; value: string; c: any }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text style={{ fontSize: 14, color: c.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: "600", color: c.text }}>{value}</Text>
    </View>
  );
}
