/**
 * Ducky Intelligence — Color definitions
 *
 * Primary: Cavaridge navy #2E5090
 * Accent: Ducky gold/amber #F59E0B
 * Dark bg: #0f172a (slate-900)
 */

export const colors = {
  light: {
    background: "#f8f9fa",
    card: "#ffffff",
    cardBorder: "#e2e8f0",
    text: "#0f172a",
    textSecondary: "#64748b",
    textMuted: "#94a3b8",
    primary: "#2E5090",
    primaryLight: "#dbeafe",
    primaryForeground: "#ffffff",
    accent: "#f1f5f9",
    accentForeground: "#334155",
    border: "#e2e8f0",
    inputBg: "#f8fafc",
    inputBorder: "#cbd5e1",
    success: "#16a34a",
    successBg: "#f0fdf4",
    successBorder: "#bbf7d0",
    warning: "#d97706",
    warningBg: "#fffbeb",
    warningBorder: "#fde68a",
    error: "#dc2626",
    errorBg: "#fef2f2",
    errorBorder: "#fecaca",
    duckyGold: "#F59E0B",
    duckyGoldLight: "#FEF3C7",
    userBubble: "#2E5090",
    userBubbleText: "#ffffff",
    assistantBubble: "#f1f5f9",
    assistantBubbleText: "#0f172a",
  },
  dark: {
    background: "#0f172a",
    card: "#1e293b",
    cardBorder: "#334155",
    text: "#f1f5f9",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
    primary: "#5b8ddf",
    primaryLight: "#1e3a5f",
    primaryForeground: "#ffffff",
    accent: "#1e293b",
    accentForeground: "#cbd5e1",
    border: "#334155",
    inputBg: "#1e293b",
    inputBorder: "#475569",
    success: "#22c55e",
    successBg: "#052e16",
    successBorder: "#166534",
    warning: "#f59e0b",
    warningBg: "#451a03",
    warningBorder: "#92400e",
    error: "#ef4444",
    errorBg: "#450a0a",
    errorBorder: "#991b1b",
    duckyGold: "#FBBF24",
    duckyGoldLight: "#78350f",
    userBubble: "#2E5090",
    userBubbleText: "#ffffff",
    assistantBubble: "#1e293b",
    assistantBubbleText: "#f1f5f9",
  },
};

export type ThemeColors = typeof colors.light;
