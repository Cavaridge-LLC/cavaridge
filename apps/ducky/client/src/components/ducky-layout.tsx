import { type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth, type Permission } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { DuckyAnimation } from "@cavaridge/ducky-animations";
import { Home, MessageSquare, BookOpen, Bookmark, Settings, LogOut, Sun, Moon, Monitor, Users, BarChart3, Hammer } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: typeof Home;
  requiredPermission?: Permission;
  onboardingId?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Ask Ducky", href: "/ask", icon: MessageSquare },
  { label: "Build", href: "/build", icon: Hammer, requiredPermission: "agent_create_plan" },
  { label: "Knowledge", href: "/knowledge", icon: BookOpen, onboardingId: "knowledge-sources" },
  { label: "Saved", href: "/saved", icon: Bookmark, onboardingId: "saved-answers" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, requiredPermission: "view_analytics", onboardingId: "analytics" },
  { label: "Team", href: "/admin", icon: Users, requiredPermission: "invite_users" },
  { label: "Settings", href: "/settings", icon: Settings },
];

const THEME_CYCLE = ["light", "dark", "system"] as const;
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor } as const;
const THEME_LABEL = { light: "Light Mode", dark: "Dark Mode", system: "System" } as const;

export default function DuckyLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const { theme, setTheme } = useTheme();

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.requiredPermission || hasPermission(item.requiredPermission),
  );

  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    setTheme(next);
  };

  const ThemeIcon = THEME_ICON[theme];

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[var(--theme-border)] bg-[var(--sidebar-bg)] flex flex-col">
        <div className="p-4 border-b border-[var(--theme-border)] flex items-center gap-3">
          <DuckyAnimation state="idle" size="sm" />
          <div>
            <h1 className="text-lg font-bold text-amber-500">Ducky Intelligence</h1>
            <p className="text-[10px] text-[var(--text-secondary)]">by Cavaridge</p>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {visibleNavItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => setLocation(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-amber-500/10 text-amber-500 font-medium"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
                }`}
                {...(item.onboardingId ? { "data-onboarding": item.onboardingId } : {})}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[var(--theme-border)] space-y-2">
          <button
            onClick={cycleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
          >
            <ThemeIcon className="h-4 w-4" />
            {THEME_LABEL[theme]}
          </button>
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 text-xs font-bold">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--text-primary)] truncate">{user?.name}</p>
              <p className="text-[10px] text-[var(--text-secondary)] truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="text-[var(--text-disabled)] hover:text-red-400 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[9px] text-center text-[var(--text-disabled)] pt-1">
            Powered by Ducky Intelligence
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
