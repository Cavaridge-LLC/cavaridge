import { useState, useMemo, useContext, useEffect } from "react";
import { View, Text, ScrollView, Pressable, TextInput, useWindowDimensions } from "react-native";
import { format, isSameDay, startOfDay } from "date-fns";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "@/components/theme-context";
import { EpisodeInfo } from "@/components/episode-info";
import { FrequencyCard } from "@/components/frequency-card";
import { WeekRow } from "@/components/week-row";
import { CalendarGrid } from "@/components/calendar-grid";
import { ScanTab } from "@/components/scan-tab";
import { DuckyMascot } from "@/components/ducky-mascot";
import { API_BASE_URL, BRANDING } from "@/utils/config";
import {
  calculateEpisode,
  calculateFrequencyStr,
  deriveVisitsFromDates,
  parseFrequencyStr,
} from "@/utils/episode";

type TabId = "visual" | "frequency" | "manual" | "scan";

const tabs: { id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "visual", label: "Visual", icon: "calendar" },
  { id: "frequency", label: "Frequency", icon: "create-outline" },
  { id: "manual", label: "Input", icon: "list" },
  { id: "scan", label: "EMR Scan", icon: "camera" },
];

export default function HomeScreen() {
  const { isDark, c, toggle } = useContext(ThemeContext);
  const { width } = useWindowDimensions();

  const [socDate, setSocDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<TabId>("visual");
  const [manualVisits, setManualVisits] = useState<number[]>(Array(10).fill(0));
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [frequencyInput, setFrequencyInput] = useState("");
  const [frequencyTotalInput, setFrequencyTotalInput] = useState("");

  const episode = useMemo(() => calculateEpisode(socDate), [socDate]);

  const weekCount = episode.weeks.length;

  useEffect(() => {
    setManualVisits((prev) => {
      if (prev.length === weekCount) return prev;
      const next = Array(weekCount).fill(0);
      for (let i = 0; i < Math.min(prev.length, weekCount); i++) {
        next[i] = prev[i];
      }
      return next;
    });
  }, [weekCount]);

  const parsedFrequency = useMemo(() => {
    return parseFrequencyStr(frequencyInput, weekCount);
  }, [frequencyInput, weekCount]);

  const derivedVisits = useMemo(() => {
    if (activeTab === "frequency" && parsedFrequency?.valid)
      return parsedFrequency.visits;
    if (activeTab === "manual" || activeTab === "scan")
      return manualVisits.slice(0, weekCount);
    return deriveVisitsFromDates(selectedDates, episode);
  }, [activeTab, manualVisits, selectedDates, episode, weekCount, parsedFrequency]);

  const frequencyStr = useMemo(
    () => calculateFrequencyStr(derivedVisits),
    [derivedVisits]
  );
  const totalVisits = derivedVisits.reduce((a, b) => a + b, 0);

  const handleVisitChange = (index: number, delta: number) => {
    const newVisits = [...manualVisits];
    newVisits[index] = Math.max(0, newVisits[index] + delta);
    setManualVisits(newVisits);
  };

  const toggleDate = (date: Date) => {
    const normalized = startOfDay(date);
    setSelectedDates((prev) => {
      const exists = prev.some((d) => isSameDay(d, normalized));
      if (exists) return prev.filter((d) => !isSameDay(d, normalized));
      return [...prev, normalized];
    });
  };

  const applyScannedVisits = (visits: number[]) => {
    setManualVisits(visits);
    setActiveTab("manual");
  };

  const applyFrequencyInput = () => {
    if (parsedFrequency?.valid) {
      setManualVisits(parsedFrequency.visits);
      setActiveTab("manual");
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingBottom: 40 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 60 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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
              <Ionicons name="pulse" size={26} color={c.primary} />
            </View>
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: "800",
                    color: c.text,
                    letterSpacing: -0.5,
                  }}
                >
                  {BRANDING.appName}
                </Text>
                <DuckyMascot state="idle" size="sm" colors={c} />
              </View>
              <Text style={{ fontSize: 13, color: c.textSecondary }}>
                {BRANDING.appDescription}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={toggle}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: c.border,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: c.card,
            }}
          >
            <Ionicons
              name={isDark ? "sunny" : "moon"}
              size={20}
              color={c.text}
            />
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: c.primaryLight,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: c.primary + "30",
            }}
          >
            <Ionicons name="shield-checkmark" size={14} color={c.primary} />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: c.primary,
              }}
            >
              CMS CY 2026 Guidelines
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: c.textMuted, flexShrink: 1 }}>
            60-day cert per 42 CFR §424.22 · PDGM 30-day periods
          </Text>
        </View>

        <EpisodeInfo
          socDate={socDate}
          onDateChange={setSocDate}
          episode={episode}
          c={c}
        />

        <FrequencyCard
          frequencyStr={frequencyStr}
          totalVisits={totalVisits}
          c={c}
        />

        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              backgroundColor: c.accent,
              borderRadius: 10,
              padding: 4,
              marginBottom: 20,
            }}
          >
            {tabs.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor:
                    activeTab === tab.id ? c.primary : "transparent",
                }}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={16}
                  color={
                    activeTab === tab.id ? c.primaryForeground : c.textSecondary
                  }
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color:
                      activeTab === tab.id
                        ? c.primaryForeground
                        : c.textSecondary,
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {activeTab === "visual" && (
            <View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: c.text,
                  marginBottom: 4,
                }}
              >
                Select Appointment Dates
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: c.textSecondary,
                  marginBottom: 16,
                }}
              >
                Tap days on the calendar to schedule visits.
              </Text>
              <CalendarGrid
                episode={episode}
                selectedDates={selectedDates}
                onToggleDate={toggleDate}
                c={c}
              />
              {selectedDates.length > 0 && (
                <Pressable
                  onPress={() => setSelectedDates([])}
                  style={{ alignSelf: "flex-end", marginTop: 12, padding: 8 }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color: c.textSecondary,
                      fontWeight: "500",
                    }}
                  >
                    Clear Selections
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {activeTab === "frequency" && (
            <View>
              <Text style={{ fontSize: 18, fontWeight: "700", color: c.text, marginBottom: 4 }}>
                Frequency Input
              </Text>
              <Text style={{ fontSize: 14, color: c.textSecondary, marginBottom: 16 }}>
                Enter visit frequency notation to generate a weekly visit plan
              </Text>

              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: c.text, marginBottom: 6 }}>
                  Frequency Notation
                </Text>
                <TextInput
                  value={frequencyInput}
                  onChangeText={setFrequencyInput}
                  placeholder="e.g., 1W1, 3W8"
                  placeholderTextColor={c.textMuted}
                  style={{
                    backgroundColor: c.accent,
                    borderRadius: 10,
                    padding: 14,
                    fontSize: 18,
                    fontFamily: "monospace",
                    color: c.text,
                    borderWidth: 1,
                    borderColor: c.border,
                  }}
                  autoCapitalize="characters"
                />
                <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 4 }}>
                  Format: visitsWweeks — e.g., "3W2" = 3 visits/week for 2 weeks
                </Text>
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: c.text, marginBottom: 6 }}>
                  Expected Total Visits (optional)
                </Text>
                <TextInput
                  value={frequencyTotalInput}
                  onChangeText={setFrequencyTotalInput}
                  placeholder="e.g., 25"
                  placeholderTextColor={c.textMuted}
                  keyboardType="number-pad"
                  style={{
                    backgroundColor: c.accent,
                    borderRadius: 10,
                    padding: 14,
                    fontSize: 16,
                    color: c.text,
                    borderWidth: 1,
                    borderColor: c.border,
                    width: 120,
                  }}
                />
              </View>

              {frequencyInput.trim() !== "" && parsedFrequency && (
                <View>
                  {parsedFrequency.error && (
                    <View style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: parsedFrequency.valid ? "#FEF3C7" : "#FEE2E2",
                      padding: 10,
                      borderRadius: 8,
                      marginBottom: 12,
                    }}>
                      <Ionicons name="alert-circle" size={16} color={parsedFrequency.valid ? "#D97706" : "#DC2626"} />
                      <Text style={{ fontSize: 13, color: parsedFrequency.valid ? "#92400E" : "#991B1B", flex: 1 }}>
                        {parsedFrequency.error}
                      </Text>
                    </View>
                  )}

                  {parsedFrequency.valid && (
                    <View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
                        <View style={{ backgroundColor: c.accent, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: c.border }}>
                          <Text style={{ fontSize: 11, color: c.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            Parsed Total
                          </Text>
                          <Text style={{
                            fontSize: 20,
                            fontWeight: "800",
                            fontFamily: "monospace",
                            color: frequencyTotalInput && parseInt(frequencyTotalInput) !== parsedFrequency.totalVisits ? "#D97706" : c.text,
                          }}>
                            {parsedFrequency.totalVisits} visits
                          </Text>
                        </View>
                        {frequencyTotalInput !== "" && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Ionicons
                              name={parseInt(frequencyTotalInput) === parsedFrequency.totalVisits ? "checkmark-circle" : "alert-circle"}
                              size={16}
                              color={parseInt(frequencyTotalInput) === parsedFrequency.totalVisits ? "#16A34A" : "#D97706"}
                            />
                            <Text style={{
                              fontSize: 12,
                              fontWeight: "600",
                              color: parseInt(frequencyTotalInput) === parsedFrequency.totalVisits ? "#16A34A" : "#D97706",
                            }}>
                              {parseInt(frequencyTotalInput) === parsedFrequency.totalVisits
                                ? "Matches"
                                : `Expected ${frequencyTotalInput}`}
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text style={{ fontSize: 14, fontWeight: "600", color: c.text, marginBottom: 8 }}>
                        Weekly Distribution
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                        {episode.weeks.map((week, i) => (
                          <View key={i} style={{
                            backgroundColor: parsedFrequency.visits[i] > 0 ? c.primaryLight : c.accent,
                            borderWidth: 1,
                            borderColor: parsedFrequency.visits[i] > 0 ? c.primary + "30" : c.border,
                            borderRadius: 10,
                            padding: 10,
                            alignItems: "center",
                            minWidth: 60,
                          }}>
                            <Text style={{ fontSize: 11, color: c.textMuted, fontWeight: "500" }}>W{week.weekNumber}</Text>
                            <Text style={{ fontSize: 18, fontWeight: "800", fontFamily: "monospace", color: c.text }}>{parsedFrequency.visits[i]}</Text>
                            <Text style={{ fontSize: 9, color: c.textMuted }}>{week.daysInWeek}d</Text>
                          </View>
                        ))}
                      </View>

                      <Pressable
                        onPress={applyFrequencyInput}
                        style={{
                          backgroundColor: c.primary,
                          borderRadius: 10,
                          paddingVertical: 12,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: c.primaryForeground, fontWeight: "700", fontSize: 15 }}>
                          Apply to Weekly Input
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {activeTab === "manual" && (
            <View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: c.text,
                  marginBottom: 4,
                }}
              >
                Weekly Certification Breakdown
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: c.textSecondary,
                  marginBottom: 16,
                }}
              >
                Allocate prescribed visits per week
              </Text>
              {episode.weeks.map((week, index) => {
                const prevWeek = index > 0 ? episode.weeks[index - 1] : null;
                const showDivider = prevWeek && prevWeek.dayEnd <= 30 && week.dayStart > 30;
                return (
                <View key={index}>
                  {showDivider && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        marginVertical: 12,
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          height: 2,
                          borderStyle: "dashed",
                          borderTopWidth: 2,
                          borderColor: c.primary + "50",
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: c.primary,
                          backgroundColor: c.primaryLight,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 12,
                          overflow: "hidden",
                        }}
                      >
                        30-Day Payment Period 2 Begins
                      </Text>
                      <View
                        style={{
                          flex: 1,
                          height: 2,
                          borderStyle: "dashed",
                          borderTopWidth: 2,
                          borderColor: c.primary + "50",
                        }}
                      />
                    </View>
                  )}
                  <WeekRow
                    week={week}
                    index={index}
                    visits={derivedVisits[index]}
                    onIncrement={() => handleVisitChange(index, 1)}
                    onDecrement={() => handleVisitChange(index, -1)}
                    c={c}
                  />
                </View>
                );
              })}
            </View>
          )}

          {activeTab === "scan" && (
            <ScanTab
              socDateStr={format(socDate, "yyyy-MM-dd")}
              currentFrequencyStr={frequencyStr}
              onApplyVisits={applyScannedVisits}
              c={c}
              apiBaseUrl={API_BASE_URL}
            />
          )}
        </View>

        <View
          style={{
            marginTop: 32,
            paddingTop: 20,
            borderTopWidth: 1,
            borderTopColor: c.border,
            alignItems: "center",
            gap: 8,
          }}
        >
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
