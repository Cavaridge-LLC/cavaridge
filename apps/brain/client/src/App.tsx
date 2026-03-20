/**
 * CVG-BRAIN — Main App Shell
 *
 * Routes: Record, Knowledge, Recall, Connectors, Settings
 * Ducky Intelligence branding. "Powered by Ducky Intelligence" footer.
 */

import { Routes, Route, NavLink } from "react-router-dom";
import { Mic, Brain, Search, Plug, Settings, Moon, Sun, Monitor } from "lucide-react";
import { RecordPage } from "./pages/RecordPage.js";
import { KnowledgePage } from "./pages/KnowledgePage.js";
import { RecallPage } from "./pages/RecallPage.js";
import { ConnectorsPage } from "./pages/ConnectorsPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { useTheme } from "./providers/ThemeProvider.js";

const NAV_ITEMS = [
  { to: "/", icon: Mic, label: "Record" },
  { to: "/knowledge", icon: Brain, label: "Knowledge" },
  { to: "/recall", icon: Search, label: "Recall" },
  { to: "/connectors", icon: Plug, label: "Connectors" },
  { to: "/settings", icon: Settings, label: "Settings" },
] as const;

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const icons = { light: Sun, dark: Moon, system: Monitor };
  const next: Record<string, "light" | "dark" | "system"> = { light: "dark", dark: "system", system: "light" };
  const Icon = icons[theme];

  return (
    <button
      onClick={() => setTheme(next[theme])}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      title={`Theme: ${theme}`}
    >
      <Icon className="w-5 h-5 text-[var(--brain-text-muted)]" />
    </button>
  );
}

export function App() {
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <nav className="w-16 md:w-56 flex-shrink-0 bg-[var(--brain-surface-alt)] border-r border-[var(--brain-border)] flex flex-col">
        {/* Logo */}
        <div className="p-3 md:p-4 border-b border-[var(--brain-border)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--brain-primary)] flex items-center justify-center text-white font-bold text-sm">
              B
            </div>
            <span className="hidden md:block font-semibold text-[var(--brain-text)]">Brain</span>
          </div>
        </div>

        {/* Nav links */}
        <div className="flex-1 py-2">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 md:px-4 py-2.5 mx-1 md:mx-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-[var(--brain-primary)]/10 text-[var(--brain-primary)] font-medium"
                    : "text-[var(--brain-text-muted)] hover:bg-gray-100 dark:hover:bg-gray-800"
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="hidden md:block text-sm">{label}</span>
            </NavLink>
          ))}
        </div>

        {/* Theme toggle + footer */}
        <div className="border-t border-[var(--brain-border)] p-2 md:p-3">
          <ThemeToggle />
          <p className="hidden md:block text-[10px] text-[var(--brain-text-muted)] mt-2 text-center">
            Powered by Ducky Intelligence
          </p>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-[var(--brain-surface)]">
        <Routes>
          <Route path="/" element={<RecordPage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/recall" element={<RecallPage />} />
          <Route path="/connectors" element={<ConnectorsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
