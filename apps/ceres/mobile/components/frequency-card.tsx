import { View, Text, Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { ThemeColors } from "@/utils/theme";
import { Ionicons } from "@expo/vector-icons";

interface FrequencyCardProps {
  frequencyStr: string;
  totalVisits: number;
  c: ThemeColors;
}

export function FrequencyCard({
  frequencyStr,
  totalVisits,
  c,
}: FrequencyCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(frequencyStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View
      style={{
        backgroundColor: c.primary,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <Ionicons name="clipboard-outline" size={20} color={c.primaryForeground} />
        <Text
          style={{
            fontSize: 17,
            fontWeight: "700",
            color: c.primaryForeground,
          }}
        >
          Frequency Order
        </Text>
      </View>

      <View
        style={{
          backgroundColor: "rgba(0,0,0,0.15)",
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.1)",
          marginBottom: 14,
        }}
      >
        <Text
          selectable
          style={{
            fontFamily: "monospace",
            fontSize: 20,
            fontWeight: "700",
            color: c.primaryForeground,
            textAlign: "center",
          }}
        >
          {frequencyStr}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.8)",
          }}
        >
          Total Visits:{" "}
          <Text style={{ fontWeight: "700", color: c.primaryForeground }}>
            {totalVisits}
          </Text>
        </Text>

        <Pressable
          onPress={handleCopy}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#ffffff",
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 8,
            gap: 6,
          }}
        >
          <Ionicons
            name={copied ? "checkmark-circle" : "copy-outline"}
            size={16}
            color={c.primary}
          />
          <Text style={{ fontSize: 14, fontWeight: "600", color: c.primary }}>
            {copied ? "Copied" : "Copy Order"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
