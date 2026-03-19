import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { DuckyAnimation } from "@cavaridge/ducky-animations";
import {
  LayoutDashboard,
  Settings,
  Clock,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Menu,
  X,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
];

function useCurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return time;
}

export default function VesparLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const time = useCurrentTime();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const themeLabel = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  const activeNav = navItems.find((item) => item.path === location) || navItems[0];

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  const formattedTime = time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const formattedDate = time.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          flex flex-col items-center py-3 gap-1 border-r flex-shrink-0 z-50
          transition-transform duration-200
          fixed md:relative h-full
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
        style={{
          width: 64,
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border-primary)",
        }}
      >
        {/* Logo mark */}
        <div className="mb-3 flex items-center justify-center">
          <div className="relative w-7 h-7">
            <div
              className="absolute inset-0 rounded-[3px]"
              style={{
                backgroundColor: "var(--accent-blue)",
                boxShadow: "0 0 16px rgba(59,130,246,0.5)",
              }}
            />
          </div>
        </div>

        <div className="w-8 h-px mb-1" style={{ backgroundColor: "var(--border-primary)" }} />

        {/* Nav items */}
        <nav className="flex flex-col items-center gap-0.5 flex-1">
          {navItems.map((item) => {
            const isActive = activeNav.id === item.id;
            return (
              <Tooltip key={item.id} delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    data-testid={`nav-${item.id}`}
                    onClick={() => {
                      setLocation(item.path);
                      setMobileMenuOpen(false);
                    }}
                    className="relative flex flex-col items-center justify-center w-12 h-12 rounded-md transition-colors duration-150 cursor-pointer"
                    style={{
                      color: isActive ? "var(--accent-blue)" : "var(--text-disabled)",
                    }}
                  >
                    {isActive && (
                      <div
                        className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r"
                        style={{
                          backgroundColor: "var(--accent-blue)",
                          boxShadow: "0 0 6px rgba(59,130,246,0.5)",
                        }}
                      />
                    )}
                    <item.icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2 : 1.5} />
                    <span className="text-[9px] mt-0.5 font-medium tracking-wide">
                      {item.label}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto flex flex-col items-center gap-1.5">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="mb-1 cursor-default">
                <DuckyAnimation state="idle" size="sm" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Ducky Intelligence
            </TooltipContent>
          </Tooltip>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                data-testid="button-logout"
                onClick={() => logout()}
                className="flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer"
                style={{ color: "var(--text-disabled)" }}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Sign Out
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header
          className="flex items-center justify-between px-4 border-b flex-shrink-0"
          style={{
            height: 48,
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border-primary)",
          }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-md cursor-pointer"
              style={{ color: "var(--text-secondary)" }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <span
              className="font-semibold text-sm tracking-wider"
              style={{ color: "var(--text-primary)" }}
            >
              VESPAR
            </span>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-5"
              style={{
                borderColor: "var(--border-primary)",
                color: "var(--text-disabled)",
              }}
            >
              v1.0
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            {/* Clock */}
            <div className="hidden sm:flex items-center gap-1.5" style={{ color: "var(--text-disabled)" }}>
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[11px]" data-testid="text-clock">
                {formattedTime}
              </span>
              <span className="mx-0.5" style={{ color: "var(--border-primary)" }}>|</span>
              <span className="text-[11px]" data-testid="text-date">{formattedDate}</span>
            </div>

            {/* Theme toggle */}
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  data-testid="button-theme-toggle"
                  onClick={cycleTheme}
                  className="flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <ThemeIcon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Theme: {themeLabel}
              </TooltipContent>
            </Tooltip>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-testid="button-user-menu"
                  className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1 transition-colors"
                >
                  <span
                    className="text-[11px] hidden sm:inline"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {user?.name}
                  </span>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold border"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      borderColor: "var(--border-primary)",
                    }}
                  >
                    {initials}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48"
                style={{
                  background: "var(--bg-secondary)",
                  borderColor: "var(--border-primary)",
                }}
              >
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {user?.name}
                    </span>
                    <span className="text-xs font-normal" style={{ color: "var(--text-disabled)" }}>
                      {user?.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator style={{ backgroundColor: "var(--border-primary)" }} />
                <DropdownMenuItem
                  data-testid="menu-signout"
                  className="cursor-pointer text-red-400"
                  onClick={() => logout()}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main content */}
        <main
          className="flex-1 overflow-auto"
          style={{ backgroundColor: "var(--bg-primary)" }}
        >
          {children}
        </main>

        {/* Footer */}
        <footer
          className="flex items-center justify-between px-4 border-t flex-shrink-0"
          style={{
            height: 28,
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border-primary)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full bg-[#10B981]"
              style={{ boxShadow: "0 0 4px rgba(16,185,129,0.6)" }}
            />
            <span className="text-[10px]" style={{ color: "var(--text-disabled)" }} data-testid="text-system-status">
              System Online
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--text-disabled)" }}>
              <DuckyAnimation state="idle" size="sm" className="!w-3 !h-3" />
              Powered by Ducky Intelligence
            </span>
            <div className="h-3 w-px" style={{ backgroundColor: "var(--border-primary)" }} />
            <span className="text-[10px]" style={{ color: "var(--text-disabled)" }}>
              VESPAR &copy; 2026
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
