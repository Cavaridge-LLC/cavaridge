import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ThemeColors } from "@/utils/theme";
import { calculateFrequencyStr } from "@/utils/episode";
import { Ionicons } from "@expo/vector-icons";

interface ScanResult {
  detected: string;
  visits: number[];
  notes: string;
  confidence: string;
  status: "success" | "warning";
}

interface ScanTabProps {
  socDateStr: string;
  currentFrequencyStr: string;
  onApplyVisits: (visits: number[]) => void;
  c: ThemeColors;
  apiBaseUrl: string;
}

export function ScanTab({
  socDateStr,
  currentFrequencyStr,
  onApplyVisits,
  c,
  apiBaseUrl,
}: ScanTabProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to scan EMR schedules."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].base64) {
      await scanImage(result.assets[0].base64);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow camera access to scan EMR schedules."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].base64) {
      await scanImage(result.assets[0].base64);
    }
  };

  const scanImage = async (base64: string) => {
    setIsScanning(true);
    setScanResult(null);
    setScanError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/scan-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: `data:image/jpeg;base64,${base64}`,
          socDate: socDateStr,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to scan schedule");
      }

      const data = await response.json();
      const extractedFreqStr = calculateFrequencyStr(data.visits);
      const isMatch = currentFrequencyStr === extractedFreqStr;

      setScanResult({
        detected: extractedFreqStr,
        visits: data.visits,
        notes: data.notes,
        confidence: data.confidence,
        status: isMatch ? "success" : "warning",
      });
    } catch (err: any) {
      setScanError(err.message || "Something went wrong scanning the image.");
    } finally {
      setIsScanning(false);
    }
  };

  const confidenceColor = (conf: string) => {
    if (conf === "high") return c.success;
    if (conf === "medium") return c.warning;
    return c.error;
  };

  return (
    <View>
      <Text style={{ fontSize: 18, fontWeight: "700", color: c.text }}>
        EMR Schedule Scanner
      </Text>
      <Text
        style={{ fontSize: 14, color: c.textSecondary, marginTop: 4, marginBottom: 20 }}
      >
        Upload or photograph a schedule to auto-detect frequency.
      </Text>

      {isScanning ? (
        <View
          style={{
            borderWidth: 2,
            borderStyle: "dashed",
            borderColor: c.primary + "80",
            borderRadius: 16,
            padding: 48,
            alignItems: "center",
            backgroundColor: c.primaryLight + "20",
          }}
        >
          <ActivityIndicator size="large" color={c.primary} />
          <Text
            style={{
              fontSize: 17,
              fontWeight: "600",
              color: c.text,
              marginTop: 16,
            }}
          >
            Scanning Schedule...
          </Text>
          <Text
            style={{ fontSize: 14, color: c.textSecondary, marginTop: 4 }}
          >
            Extracting dates using AI
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Pressable
            onPress={takePhoto}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              backgroundColor: c.primary,
              paddingVertical: 16,
              borderRadius: 14,
            }}
          >
            <Ionicons name="camera" size={22} color={c.primaryForeground} />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: c.primaryForeground,
              }}
            >
              Take Photo
            </Text>
          </Pressable>

          <Pressable
            onPress={pickImage}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              borderWidth: 1,
              borderColor: c.border,
              paddingVertical: 16,
              borderRadius: 14,
              backgroundColor: c.card,
            }}
          >
            <Ionicons name="image-outline" size={22} color={c.text} />
            <Text style={{ fontSize: 16, fontWeight: "600", color: c.text }}>
              Choose from Library
            </Text>
          </Pressable>
        </View>
      )}

      {scanError && (
        <View
          style={{
            marginTop: 16,
            backgroundColor: c.errorBg,
            borderWidth: 1,
            borderColor: c.errorBorder,
            borderRadius: 14,
            padding: 16,
            flexDirection: "row",
            gap: 12,
          }}
        >
          <Ionicons name="alert-circle" size={22} color={c.error} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: c.text }}>
              Scan Failed
            </Text>
            <Text
              style={{ fontSize: 14, color: c.textSecondary, marginTop: 4 }}
            >
              {scanError}
            </Text>
          </View>
        </View>
      )}

      {scanResult && (
        <View
          style={{
            marginTop: 16,
            backgroundColor:
              scanResult.status === "success" ? c.successBg : c.warningBg,
            borderWidth: 1,
            borderColor:
              scanResult.status === "success"
                ? c.successBorder
                : c.warningBorder,
            borderRadius: 14,
            padding: 16,
          }}
        >
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
            <Ionicons
              name={
                scanResult.status === "success"
                  ? "checkmark-circle"
                  : "alert-circle"
              }
              size={22}
              color={
                scanResult.status === "success" ? c.success : c.warning
              }
            />
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "600", color: c.text }}
                >
                  {scanResult.status === "success"
                    ? "Schedule Matches"
                    : "Frequency Mismatch"}
                </Text>
                <View
                  style={{
                    backgroundColor: confidenceColor(scanResult.confidence) + "20",
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: confidenceColor(scanResult.confidence),
                    }}
                  >
                    {scanResult.confidence} confidence
                  </Text>
                </View>
              </View>
              {scanResult.notes ? (
                <Text
                  style={{
                    fontSize: 14,
                    color: c.textSecondary,
                    marginTop: 6,
                  }}
                >
                  {scanResult.notes}
                </Text>
              ) : null}
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              gap: 12,
              backgroundColor: c.card + "80",
              borderRadius: 10,
              padding: 12,
              borderWidth: 1,
              borderColor: c.border + "30",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: c.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}
              >
                Detected
              </Text>
              <Text
                selectable
                style={{
                  fontFamily: "monospace",
                  fontSize: 17,
                  fontWeight: "700",
                  color: c.text,
                }}
              >
                {scanResult.detected}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: c.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}
              >
                Current Input
              </Text>
              <Text
                selectable
                style={{
                  fontFamily: "monospace",
                  fontSize: 17,
                  fontWeight: "700",
                  color: c.text,
                }}
              >
                {currentFrequencyStr}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => onApplyVisits(scanResult.visits)}
            style={{
              marginTop: 14,
              backgroundColor: c.primary,
              paddingVertical: 12,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: c.primaryForeground,
              }}
            >
              Apply Detected Schedule
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
