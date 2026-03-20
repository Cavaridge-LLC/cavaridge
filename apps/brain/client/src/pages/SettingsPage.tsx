/**
 * Settings Page — App configuration
 *
 * Theme selection, language, recording preferences, account info.
 */

import { Moon, Sun, Monitor, Volume2, Globe } from "lucide-react";
import { useTheme } from "../providers/ThemeProvider.js";

export function SettingsPage() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
    { value: "system" as const, icon: Monitor, label: "System" },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--brain-text)] mb-6">Settings</h1>

      {/* Theme */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[var(--brain-text)] mb-3">Appearance</h2>
        <div className="flex gap-3">
          {themes.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
                theme === value
                  ? "border-[var(--brain-primary)] bg-[var(--brain-primary)]/10 text-[var(--brain-primary)]"
                  : "border-[var(--brain-border)] text-[var(--brain-text-muted)] hover:border-[var(--brain-primary)]/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Voice Settings */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[var(--brain-text)] mb-3 flex items-center gap-2">
          <Volume2 className="w-4 h-4" /> Voice Capture
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-[var(--brain-surface-alt)] rounded-lg border border-[var(--brain-border)]">
            <div>
              <p className="text-sm text-[var(--brain-text)]">Auto-process after recording</p>
              <p className="text-xs text-[var(--brain-text-muted)]">Automatically extract knowledge when recording stops</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-300 dark:bg-gray-600 peer-checked:bg-[var(--brain-primary)] rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
            </label>
          </div>

          <div className="flex items-center justify-between p-3 bg-[var(--brain-surface-alt)] rounded-lg border border-[var(--brain-border)]">
            <div>
              <p className="text-sm text-[var(--brain-text)]">Clean up transcript</p>
              <p className="text-xs text-[var(--brain-text-muted)]">Remove filler words and fix punctuation</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-300 dark:bg-gray-600 peer-checked:bg-[var(--brain-primary)] rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
            </label>
          </div>
        </div>
      </section>

      {/* Language */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[var(--brain-text)] mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4" /> Language
        </h2>
        <select className="w-full p-2.5 rounded-lg border border-[var(--brain-border)] bg-[var(--brain-surface)] text-sm text-[var(--brain-text)] focus:outline-none focus:ring-2 focus:ring-[var(--brain-primary)]/30">
          <option value="en-US">English (US)</option>
          <option value="en-GB">English (UK)</option>
          <option value="es-ES">Spanish</option>
          <option value="fr-FR">French</option>
          <option value="de-DE">German</option>
        </select>
      </section>

      {/* About */}
      <section className="pt-6 border-t border-[var(--brain-border)]">
        <div className="text-center">
          <p className="text-sm text-[var(--brain-text)]">Brain v0.1.0</p>
          <p className="text-xs text-[var(--brain-text-muted)] mt-1">Voice-First Knowledge Capture & Recall</p>
          <p className="text-xs text-[var(--brain-text-muted)] mt-3">Powered by Ducky Intelligence</p>
          <p className="text-[10px] text-[var(--brain-text-muted)] mt-1">&copy; 2026 Cavaridge, LLC. All rights reserved.</p>
        </div>
      </section>
    </div>
  );
}
