import { type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Home, MessageSquare, BookOpen, Bookmark, Settings, LogOut, Sun, Moon } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: typeof Home;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Ask Ducky", href: "/ask", icon: MessageSquare },
  { label: "Knowledge", href: "/knowledge", icon: BookOpen },
  { label: "Saved", href: "/saved", icon: Bookmark },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function DuckyLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[var(--theme-border)] bg-[var(--sidebar-bg)] flex flex-col">
        <div className="p-4 border-b border-[var(--theme-border)]">
          <h1 className="text-xl font-bold text-amber-500">Ducky</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">THE AI-native answer engine</p>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
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
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[var(--theme-border)] space-y-2">
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
          >
            {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
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
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
