import type { ReactNode } from "react";
import { createContext, useState } from "react";
import { useColorScheme } from "react-native";
import { colors, ThemeColors } from "@/utils/theme";

interface ThemeContextType {
  isDark: boolean;
  c: ThemeColors;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  c: colors.light,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<"light" | "dark" | "system">("system");

  const isDark = mode === "system" ? systemScheme === "dark" : mode === "dark";
  const c = isDark ? colors.dark : colors.light;

  const toggle = () => {
    if (mode === "system") {
      setMode(isDark ? "light" : "dark");
    } else {
      setMode(mode === "dark" ? "light" : "dark");
    }
  };

  return (
    <ThemeContext.Provider value={{ isDark, c, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
