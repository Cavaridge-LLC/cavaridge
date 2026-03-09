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
            />
          </>
        )}
      </ThemeContext.Consumer>
    </ThemeProvider>
  );
}
