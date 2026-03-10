import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Sun, Moon, Monitor } from "lucide-react";

export default function SettingsPage() {
  const { user, organization } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">Settings</h2>

      {/* Profile */}
      <div className="mb-8">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wide">Profile</h3>
        <div className="p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--bg-card)] space-y-3">
          <div>
            <label className="text-xs text-[var(--text-secondary)]">Name</label>
            <p className="text-sm text-[var(--text-primary)]">{user?.name}</p>
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)]">Email</label>
            <p className="text-sm text-[var(--text-primary)]">{user?.email}</p>
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)]">Organization</label>
            <p className="text-sm text-[var(--text-primary)]">{organization?.name || "—"}</p>
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)]">Role</label>
            <p className="text-sm text-[var(--text-primary)] capitalize">{user?.role?.replace(/_/g, " ")}</p>
          </div>
        </div>
      </div>

      {/* Theme */}
      <div>
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wide">Appearance</h3>
        <div className="grid grid-cols-3 gap-3">
          {([
            { value: "light" as const, label: "Light", icon: Sun },
            { value: "dark" as const, label: "Dark", icon: Moon },
            { value: "system" as const, label: "System", icon: Monitor },
          ]).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-colors ${
                theme === value
                  ? "border-amber-500 bg-amber-500/10 text-amber-500"
                  : "border-[var(--theme-border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
