import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
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
              <Stack.Screen name="index" />
              <Stack.Screen name="compliance" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="privacy" options={{ presentation: "modal" }} />
            </Stack>
          </>
        )}
      </ThemeContext.Consumer>
    </ThemeProvider>
  );
}
