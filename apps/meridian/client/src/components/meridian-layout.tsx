import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  GitPullRequest,
  ShieldAlert,
  ShieldCheck,
  MessageSquare,
  Server,
  BookOpen,
  FlaskConical,
  BarChart3,
  ChevronRight,
  Clock,
  Database,
  FileText,
  LogOut,
  Settings,
  User,
  Sun,
  Moon,
  Monitor,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface SystemStatus {
  status: string;
  dbConnected: boolean;
  activeDeals: number;
  openAlerts: number;
  totalDocuments: number;
  totalFindings: number;
  uptime: number;
}

const navItems = [
  { id: "pipeline", label: "Pipeline", icon: GitPullRequest, path: "/", onboardingId: "deal-pipeline" },
  { id: "risk", label: "Risk", icon: ShieldAlert, path: "/risk", onboardingId: "risk-assessment" },
  { id: "ask-ai", label: "Ask AI", icon: MessageSquare, path: "/ask-ai" },
  { id: "infra", label: "Infra", icon: Server, path: "/infra" },
  { id: "playbook", label: "Playbook", icon: BookOpen, path: "/playbook", onboardingId: "playbooks" },
  { id: "simulator", label: "Simulator", icon: FlaskConical, path: "/simulator" },
  { id: "portfolio", label: "Portfolio", icon: BarChart3, path: "/portfolio" },
  { id: "reports", label: "Reports", icon: FileText, path: "/reports" },
  { id: "knowledge-graph", label: "Knowledge Graph", icon: Database, path: "/knowledge-graph" },
];

function useCurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return time;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function MeridianLogo({ orgLogoUrl }: { orgLogoUrl?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-5 h-5">
        <div
          className="absolute inset-0 bg-[#3B82F6] rotate-45 rounded-[2px]"
          style={{ boxShadow: "0 0 12px rgba(59,130,246,0.4)" }}
        />
      </div>
      <span className="font-data text-sm font-semibold tracking-wider text-[var(--text-primary)]">
        MERIDIAN
      </span>
      {orgLogoUrl && (
        <>
          <div className="h-4 w-px bg-[var(--theme-border)]/60" />
          <img src={orgLogoUrl} alt="Organization" className="h-6 object-contain" />
        </>
      )}
    </div>
  );
}

const ROLE_COLORS: Record<string, string> = {
  platform_owner: "text-red-400",
  platform_admin: "text-orange-400",
  org_owner: "text-amber-400",
  org_admin: "text-blue-400",
  analyst: "text-emerald-400",
  integration_pm: "text-purple-400",
  viewer: "text-gray-400",
};

export default function MeridianLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const time = useCurrentTime();
  const { user, organization, logout, hasPermission, hasPlanFeature, planTier, isPlatformUser, switchOrg } = useAuth();
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const themeLabel = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  const { data: versionData } = useQuery<{ version: string; build: number; full: string; timestamp: string; environment: string }>({
    queryKey: ["/api/version"],
    staleTime: Infinity,
  });

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";
  const ROLE_LABELS: Record<string, string> = {
    platform_owner: "Platform Owner",
    platform_admin: "Platform Admin",
    org_owner: "Owner",
    org_admin: "Admin",
    analyst: "Analyst",
    integration_pm: "Integration PM",
    viewer: "Viewer",
  };
  const displayRole = ROLE_LABELS[user?.role || ""] || (user?.role || "");
  const roleColor = ROLE_COLORS[user?.role || "viewer"] || "text-gray-400";

  const canViewSettings = user?.role !== "viewer";
  const canViewPortfolio = hasPermission("view_portfolio") && hasPlanFeature("portfolioAnalytics");
  const canRunSimulations = hasPermission("run_simulations") && hasPlanFeature("digitalTwinSimulator");

  const filteredNavItems = navItems.filter((item) => {
    if (item.id === "portfolio" && !canViewPortfolio) return false;
    if (item.id === "simulator" && !canRunSimulations) return false;
    return true;
  });

  const { data: systemStatus } = useQuery<SystemStatus>({
    queryKey: ["/api/system-status"],
    refetchInterval: 30000,
  });

  const activeNav = location === "/settings"
    ? { id: "settings", label: "Settings", icon: Settings, path: "/settings" }
    : location === "/platform-admin"
    ? { id: "platform-admin", label: "Platform Admin", icon: ShieldCheck, path: "/platform-admin" }
    : filteredNavItems.find((item) => item.path === location) || filteredNavItems[0];

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
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-primary)]">
      <aside
        className="flex flex-col items-center py-3 gap-1 border-r border-[var(--theme-border)]/50 flex-shrink-0"
        style={{ width: 64, backgroundColor: "var(--sidebar-bg)" }}
      >
        <div className="mb-3 flex items-center justify-center" data-onboarding="welcome">
          <div className="relative w-7 h-7">
            <div
              className="absolute inset-0 bg-[#3B82F6] rotate-45 rounded-[3px]"
              style={{ boxShadow: "0 0 16px rgba(59,130,246,0.5)" }}
            />
          </div>
        </div>

        <div className="w-8 h-px bg-[var(--theme-border)]/60 mb-1" />

        {isPlatformUser && (
          <>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  data-testid="nav-platform-admin"
                  onClick={() => {
                    switchOrg(null);
                    setLocation("/platform-admin");
                  }}
                  className={`
                    relative flex flex-col items-center justify-center w-12 h-12 rounded-md
                    transition-colors duration-150 cursor-pointer
                    ${location === "/platform-admin"
                      ? "text-[#3B82F6]"
                      : "text-[var(--text-disabled)] hover:text-[var(--text-secondary)]"
                    }
                  `}
                >
                  {location === "/platform-admin" && (
                    <div
                      className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-[#3B82F6]"
                      style={{ boxShadow: "0 0 6px rgba(59,130,246,0.5)" }}
                    />
                  )}
                  <ShieldCheck className="w-[18px] h-[18px]" strokeWidth={location === "/platform-admin" ? 2 : 1.5} />
                  <span className="text-[9px] mt-0.5 font-medium tracking-wide sidebar-label">Admin</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Platform Admin</TooltipContent>
            </Tooltip>
            <div className="w-8 h-px bg-[var(--theme-border)]/60 mb-1" />
          </>
        )}

        <nav className="flex flex-col items-center gap-0.5 flex-1">
          {filteredNavItems.map((item) => {
            const isActive = activeNav.id === item.id;
            return (
              <Tooltip key={item.id} delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    data-testid={`nav-${item.id}`}
                    onClick={() => setLocation(item.path)}
                    className={`
                      relative flex flex-col items-center justify-center w-12 h-12 rounded-md
                      transition-colors duration-150 cursor-pointer
                      ${isActive
                        ? "text-[#3B82F6]"
                        : "text-[var(--text-disabled)] hover:text-[var(--text-secondary)]"
                      }
                    `}
                    {...(item.onboardingId ? { "data-onboarding": item.onboardingId } : {})}
                  >
                    {isActive && (
                      <div
                        className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-[#3B82F6]"
                        style={{ boxShadow: "0 0 6px rgba(59,130,246,0.5)" }}
                      />
                    )}
                    <item.icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2 : 1.5} />
                    <span className="text-[9px] mt-0.5 font-medium tracking-wide sidebar-label">
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

        <div className="mt-auto flex flex-col items-center gap-1.5">
          {canViewSettings && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  data-testid="nav-settings"
                  onClick={() => setLocation("/settings")}
                  className={`
                    flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer
                    ${location === "/settings" ? "text-[#3B82F6]" : "text-[var(--text-disabled)] hover:text-[var(--text-secondary)]"}
                  `}
                >
                  <Settings className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                Settings
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                data-testid="button-logout"
                onClick={() => logout()}
                className="flex items-center justify-center w-8 h-8 rounded-md text-[var(--text-disabled)] hover:text-red-400 transition-colors cursor-pointer"
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

      <div className="flex flex-col flex-1 min-w-0">
        <header
          className="flex items-center justify-between px-4 border-b border-[var(--theme-border)]/50 flex-shrink-0"
          style={{ height: 48, backgroundColor: "var(--bg-primary)" }}
        >
          <div className="flex items-center gap-3">
            <MeridianLogo orgLogoUrl={organization?.logoUrl} />
            <Badge
              variant="outline"
              className="text-[10px] font-data border-[var(--theme-border)] text-[var(--text-disabled)] px-1.5 py-0 h-5 no-default-hover-elevate no-default-active-elevate"
            >
              v{versionData?.version || "2.0.0"}
            </Badge>
            <Badge
              variant="outline"
              className={`text-[10px] font-data px-1.5 py-0 h-5 no-default-hover-elevate no-default-active-elevate ${
                planTier === "enterprise"
                  ? "border-amber-500/40 text-amber-400"
                  : planTier === "professional"
                  ? "border-blue-500/40 text-blue-400"
                  : "border-[var(--theme-border)] text-[var(--text-disabled)]"
              }`}
              data-testid="badge-plan-tier"
            >
              {planTier.charAt(0).toUpperCase() + planTier.slice(1)}
            </Badge>
            <div className="h-4 w-px bg-[var(--theme-border)]/60 mx-1" />
            <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <ChevronRight className="w-3 h-3 text-[var(--text-disabled)]" />
              <span className="text-xs font-medium">{activeNav.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[var(--text-disabled)]">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-data text-[11px]" data-testid="text-clock">
                {formattedTime}
              </span>
              <span className="text-[var(--theme-border)] mx-0.5">|</span>
              <span className="font-data text-[11px]" data-testid="text-date">{formattedDate}</span>
            </div>

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  data-testid="button-theme-toggle"
                  onClick={cycleTheme}
                  className="flex items-center justify-center w-8 h-8 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-panel)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <ThemeIcon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Theme: {themeLabel}
              </TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button data-testid="button-user-menu" className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1 hover:bg-[var(--bg-card)] transition-colors">
                  <span className="text-[11px] text-[var(--text-secondary)] hidden sm:inline">{user?.name}</span>
                  <Avatar className="w-7 h-7 border border-[var(--theme-border)]">
                    {user?.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                    <AvatarFallback className="bg-[var(--bg-panel)] text-[var(--text-primary)] text-[10px] font-data font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-[var(--theme-border)]" style={{ background: "var(--bg-card)" }}>
                <DropdownMenuLabel className="pb-0">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-[var(--text-primary)] font-medium">{user?.name}</span>
                    <span className="text-xs text-[var(--text-disabled)] font-normal">{user?.email}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] border-[var(--theme-border)] ${roleColor} px-1.5 py-0 h-4 no-default-hover-elevate no-default-active-elevate`}
                      >
                        {displayRole}
                      </Badge>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[var(--theme-border)]" />
                <DropdownMenuLabel className="text-[11px] text-[var(--text-disabled)] font-normal py-1">
                  {organization?.name}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[var(--theme-border)]" />
                {canViewSettings && (
                  <DropdownMenuItem
                    data-testid="menu-settings"
                    className="text-[var(--text-secondary)] cursor-pointer"
                    onClick={() => setLocation("/settings")}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  data-testid="menu-signout"
                  className="text-red-400 cursor-pointer"
                  onClick={() => logout()}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {isPlatformUser && organization && organization.slug !== "cavaridge" && (
          <div className="flex items-center justify-between px-4 py-1.5 bg-[#8B5CF6] text-white flex-shrink-0" data-testid="org-context-banner">
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>Viewing as: <span className="font-semibold">{organization.name}</span></span>
            </div>
            <button
              data-testid="button-exit-org-context"
              onClick={async () => {
                await switchOrg(null);
                setLocation("/platform-admin");
              }}
              className="flex items-center gap-1 text-xs text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Exit
            </button>
          </div>
        )}

        <main
          className="flex-1 overflow-auto"
          style={{ backgroundColor: "var(--bg-primary)" }}
        >
          {children}
        </main>

        <footer
          className="flex items-center justify-between px-4 border-t border-[var(--theme-border)]/50 flex-shrink-0"
          style={{ height: 28, backgroundColor: "var(--sidebar-bg)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  systemStatus?.dbConnected !== false ? "bg-[#10B981]" : "bg-[#F59E0B]"
                }`}
                style={systemStatus?.dbConnected !== false ? { boxShadow: "0 0 4px rgba(16,185,129,0.6)" } : undefined}
              />
              <span className="text-[10px] font-data text-[var(--text-disabled)]" data-testid="text-system-status">
                {systemStatus?.dbConnected !== false ? "System Online" : "System Degraded"}
              </span>
            </div>
            <div className="h-3 w-px bg-[var(--theme-border)]/40" />
            <div className="flex items-center gap-1 text-[var(--text-disabled)]">
              <Database className="w-3 h-3" />
              <span className="text-[10px] font-data">
                {systemStatus?.activeDeals ?? "--"} Deal{systemStatus?.activeDeals !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="h-3 w-px bg-[var(--theme-border)]/40" />
            <div className="flex items-center gap-1 text-[var(--text-disabled)]">
              <FileText className="w-3 h-3" />
              <span className="text-[10px] font-data">
                {systemStatus?.totalDocuments ?? "--"} Doc{systemStatus?.totalDocuments !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="h-3 w-px bg-[var(--theme-border)]/40" />
            <div className="flex items-center gap-1 text-[var(--text-disabled)]">
              <ShieldAlert className="w-3 h-3" />
              <span className="text-[10px] font-data">
                {systemStatus?.totalFindings ?? "--"} Finding{systemStatus?.totalFindings !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-data text-[var(--text-disabled)]">
              {user?.name} &middot; {displayRole}
            </span>
            <div className="h-3 w-px bg-[var(--theme-border)]/40" />
            <span className="text-[10px] font-data text-[var(--text-disabled)]" data-testid="text-version-status-bar">v{versionData?.full || "2.0.0+1"}</span>
            <div className="h-3 w-px bg-[var(--theme-border)]/40" />
            <span className="text-[10px] font-data text-[var(--text-disabled)]">
              Powered by Ducky Intelligence
            </span>
            <div className="h-3 w-px bg-[var(--theme-border)]/40" />
            <span className="text-[10px] font-data text-[var(--text-disabled)]">
              MERIDIAN &copy; 2026
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
