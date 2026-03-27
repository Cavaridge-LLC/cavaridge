/**
 * Settings Tab — Auth, theme toggle, API connection status
 *
 * Login/Logout via Supabase, appearance selection, system health check,
 * and app info with Ducky Intelligence branding.
 */

import { useContext, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemeContext, type ThemeMode } from "@/components/theme-context";
import { DuckyAvatar } from "@/components/ducky-avatar";
import { BRANDING, checkApiHealth } from "@/utils/api";
import {
  signIn,
  signUp,
  signOut,
  getUser,
  onAuthStateChange,
  type AuthResult,
} from "@/utils/auth";
import type { User } from "@supabase/supabase-js";

export default function SettingsScreen() {
  const { isDark, mode, c, setMode } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authAction, setAuthAction] = useState<"idle" | "signing-in" | "signing-up">("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [showAuthForm, setShowAuthForm] = useState(false);

  // API status
  const [apiStatus, setApiStatus] = useState<{
    reachable: boolean;
    status?: string;
    aiConfigured?: boolean;
  } | null>(null);
  const [checkingApi, setCheckingApi] = useState(false);

  // Load current user and listen for auth changes
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function init() {
      try {
        const currentUser = await getUser();
        setUser(currentUser);
      } catch {
        // Not authenticated
      } finally {
        setAuthLoading(false);
      }

      unsubscribe = onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
    }

    init();
    return () => unsubscribe?.();
  }, []);

  // Check API health on mount
  useEffect(() => {
    handleCheckApi();
  }, []);

  const handleCheckApi = useCallback(async () => {
    setCheckingApi(true);
    const status = await checkApiHealth();
    setApiStatus(status);
    setCheckingApi(false);
  }, []);

  const handleSignIn = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setAuthError("Email and password are required.");
      return;
    }
    setAuthError(null);
    setAuthAction("signing-in");
    const result: AuthResult = await signIn(email.trim(), password);
    if (result.success) {
      setUser(result.user ?? null);
      setShowAuthForm(false);
      setEmail("");
      setPassword("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setAuthError(result.error || "Sign in failed.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setAuthAction("idle");
  }, [email, password]);

  const handleSignUp = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setAuthError("Email and password are required.");
      return;
    }
    if (password.length < 8) {
      setAuthError("Password must be at least 8 characters.");
      return;
    }
    setAuthError(null);
    setAuthAction("signing-up");
    const result: AuthResult = await signUp(email.trim(), password);
    if (result.success) {
      setUser(result.user ?? null);
      setShowAuthForm(false);
      setEmail("");
      setPassword("");
      Alert.alert("Account Created", "Check your email for a confirmation link.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setAuthError(result.error || "Sign up failed.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setAuthAction("idle");
  }, [email, password]);

  const handleSignOut = useCallback(async () => {
    const result = await signOut();
    if (result.success) {
      setUser(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert("Error", result.error || "Failed to sign out.");
    }
  }, []);

  const themeOptions: { id: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: "light", label: "Light", icon: "sunny" },
    { id: "dark", label: "Dark", icon: "moon" },
    { id: "system", label: "System", icon: "phone-portrait" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingBottom: 40 }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
    >
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8 }}>
        {/* Header */}
        <Text style={{ fontSize: 28, fontWeight: "800", color: c.text, marginBottom: 24 }}>
          Settings
        </Text>

        {/* Account Section */}
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: c.border,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 12 }}>
            Account
          </Text>

          {authLoading ? (
            <ActivityIndicator size="small" color={c.primary} />
          ) : user ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: c.primaryLight,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="person" size={20} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>
                    {user.email}
                  </Text>
                  <Text style={{ fontSize: 12, color: c.textSecondary }}>
                    Authenticated
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={handleSignOut}
                style={{
                  backgroundColor: c.errorBg,
                  borderRadius: 10,
                  padding: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: c.errorBorder,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: c.error }}>
                  Sign Out
                </Text>
              </Pressable>
            </View>
          ) : showAuthForm ? (
            <View style={{ gap: 10 }}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={c.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  backgroundColor: c.inputBg,
                  borderWidth: 1,
                  borderColor: c.inputBorder,
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 15,
                  color: c.text,
                }}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={c.textMuted}
                secureTextEntry
                autoCapitalize="none"
                style={{
                  backgroundColor: c.inputBg,
                  borderWidth: 1,
                  borderColor: c.inputBorder,
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 15,
                  color: c.text,
                }}
              />

              {authError && (
                <View
                  style={{
                    backgroundColor: c.errorBg,
                    borderRadius: 8,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: c.errorBorder,
                  }}
                >
                  <Text style={{ fontSize: 13, color: c.error }}>{authError}</Text>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={handleSignIn}
                  disabled={authAction !== "idle"}
                  style={{
                    flex: 1,
                    backgroundColor: c.primary,
                    borderRadius: 10,
                    padding: 12,
                    alignItems: "center",
                  }}
                >
                  {authAction === "signing-in" ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#ffffff" }}>
                      Sign In
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={handleSignUp}
                  disabled={authAction !== "idle"}
                  style={{
                    flex: 1,
                    backgroundColor: c.accent,
                    borderRadius: 10,
                    padding: 12,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: c.border,
                  }}
                >
                  {authAction === "signing-up" ? (
                    <ActivityIndicator size="small" color={c.primary} />
                  ) : (
                    <Text style={{ fontSize: 14, fontWeight: "600", color: c.text }}>
                      Sign Up
                    </Text>
                  )}
                </Pressable>
              </View>

              <Pressable
                onPress={() => {
                  setShowAuthForm(false);
                  setAuthError(null);
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: c.textSecondary,
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setShowAuthForm(true)}
              style={{
                backgroundColor: c.primary,
                borderRadius: 10,
                padding: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#ffffff" }}>
                Sign In to Ducky Intelligence
              </Text>
            </Pressable>
          )}
        </View>

        {/* Theme Selection */}
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: c.border,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 12 }}>
            Appearance
          </Text>
          <View style={{ gap: 8 }}>
            {themeOptions.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => {
                  setMode(option.id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  borderRadius: 10,
                  backgroundColor: mode === option.id ? c.primaryLight : c.accent,
                  borderWidth: 1,
                  borderColor: mode === option.id ? c.primary + "40" : c.border,
                }}
              >
                <Ionicons
                  name={option.icon as any}
                  size={20}
                  color={mode === option.id ? c.primary : c.textSecondary}
                />
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: mode === option.id ? c.primary : c.text,
                    flex: 1,
                  }}
                >
                  {option.label}
                </Text>
                {mode === option.id && (
                  <Ionicons name="checkmark-circle" size={20} color={c.primary} />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* API Connection Status */}
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: c.border,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: c.text }}>
              Connection
            </Text>
            <Pressable
              onPress={handleCheckApi}
              disabled={checkingApi}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                padding: 6,
              }}
            >
              {checkingApi ? (
                <ActivityIndicator size="small" color={c.primary} />
              ) : (
                <>
                  <Ionicons name="refresh" size={16} color={c.primary} />
                  <Text style={{ fontSize: 12, color: c.primary, fontWeight: "500" }}>
                    Check
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {apiStatus ? (
            <View style={{ gap: 10 }}>
              <StatusRow
                label="API Server"
                value={apiStatus.reachable ? "Connected" : "Unreachable"}
                ok={apiStatus.reachable}
                c={c}
              />
              {apiStatus.reachable && (
                <>
                  <StatusRow
                    label="Server Status"
                    value={apiStatus.status || "Unknown"}
                    ok={apiStatus.status === "operational"}
                    c={c}
                  />
                  <StatusRow
                    label="AI Engine"
                    value={apiStatus.aiConfigured ? "Configured" : "Not configured"}
                    ok={!!apiStatus.aiConfigured}
                    c={c}
                  />
                </>
              )}
            </View>
          ) : (
            <Text style={{ fontSize: 13, color: c.textMuted }}>
              Tap "Check" to test the connection.
            </Text>
          )}
        </View>

        {/* About */}
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: c.border,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 16 }}>
            About
          </Text>

          <View style={{ alignItems: "center", gap: 12, marginBottom: 16 }}>
            <DuckyAvatar state="idle" size="xl" />
            <Text style={{ fontSize: 20, fontWeight: "800", color: c.text }}>
              {BRANDING.appName}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: c.textSecondary,
                textAlign: "center",
              }}
            >
              {BRANDING.appDescription}
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            <InfoRow label="Version" value="1.0.0" c={c} />
            <InfoRow label="Platform" value={BRANDING.parentCompany} c={c} />
            <InfoRow label="AI Engine" value="Spaniel via OpenRouter" c={c} />
            <InfoRow label="Architecture" value="Agent-first" c={c} />
          </View>
        </View>

        {/* Privacy & Legal */}
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: c.border,
            marginBottom: 16,
          }}
        >
          <Pressable
            onPress={() => router.push("/privacy")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 4,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="shield-checkmark" size={18} color={c.primary} />
              <Text style={{ fontSize: 15, fontWeight: "500", color: c.text }}>
                Privacy Policy
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>
        </View>

        {/* Footer */}
        <View
          style={{
            marginTop: 16,
            paddingTop: 20,
            borderTopWidth: 1,
            borderTopColor: c.border,
            alignItems: "center",
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <DuckyAvatar state="idle" size="sm" />
            <Text style={{ fontSize: 13, fontWeight: "500", color: c.textSecondary }}>
              {BRANDING.duckyFooter}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: c.textMuted }}>
            {new Date().getFullYear()} {BRANDING.parentCompany}. All rights reserved.
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

function StatusRow({
  label,
  value,
  ok,
  c,
}: {
  label: string;
  value: string;
  ok: boolean;
  c: any;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ fontSize: 14, color: c.textSecondary }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: ok ? c.success : c.error,
          }}
        />
        <Text style={{ fontSize: 14, fontWeight: "600", color: ok ? c.success : c.error }}>
          {value}
        </Text>
      </View>
    </View>
  );
}
