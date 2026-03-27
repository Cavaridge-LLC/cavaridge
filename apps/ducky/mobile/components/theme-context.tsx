/**
 * Theme context — Light / Dark / System with Cavaridge brand colors.
 */

import type { ReactNode } from "react";
import { createContext, useState, useCallback } from "react";
import { useColorScheme } from "react-native";
import { colors, type ThemeColors } from "@/utils/theme";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextType {
  isDark: boolean;
  mode: ThemeMode;
  c: ThemeColors;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  mode: "system",
  c: colors.light,
  toggle: () => {},
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  const isDark = mode === "system" ? systemScheme === "dark" : mode === "dark";
  const c = isDark ? colors.dark : colors.light;

  const toggle = useCallback(() => {
    if (mode === "system") {
      setModeState(isDark ? "light" : "dark");
    } else {
      setModeState(mode === "dark" ? "light" : "dark");
    }
  }, [mode, isDark]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, mode, c, toggle, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
