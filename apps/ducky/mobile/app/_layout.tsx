/**
 * Ducky Intelligence — Root Layout
 *
 * Tab navigator with 4 tabs: Ask, Knowledge, Saved, Settings.
 * Wraps the app in ThemeProvider for light/dark/system support.
 */

import { Tabs, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { ThemeProvider, ThemeContext } from "@/components/theme-context";
import React from "react";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemeContext.Consumer>
        {({ isDark, c }) => (
          <>
            <StatusBar style={isDark ? "light" : "dark"} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: c.background },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="privacy" options={{ presentation: "modal" }} />
            </Stack>
          </>
        )}
      </ThemeContext.Consumer>
    </ThemeProvider>
  );
}
