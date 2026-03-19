import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Map,
  Presentation,
  ShieldCheck,
  Settings2,
  Sun,
  Moon,
  Monitor,
  Building,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { DuckyFooter } from "./DuckyFooter";
import { clientsQuery } from "@/lib/api";
import type { Client } from "@shared/schema";
import type { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
  activeClientId: string;
  onClientChange: (id: string) => void;
}

const NAV_ITEMS = [
  { path: "/", label: "Roadmap", icon: Map },
  { path: "/security", label: "Security Score", icon: ShieldCheck },
  { path: "/qbr", label: "QBR Workspace", icon: Presentation },
  { path: "/controls", label: "Controls", icon: Settings2 },
];

export function AppLayout({ children, activeClientId, onClientChange }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const { data: clients = [] } = useQuery(clientsQuery());

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 border-r border-border bg-card/50 shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2 px-5 py-5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
            M
          </div>
          <span className="font-bold text-xl">Midas</span>
        </div>

        {/* Client Selector */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 border border-border">
            <Building className="w-4 h-4 text-muted-foreground shrink-0" />
            <select
              className="bg-transparent border-none text-sm font-medium outline-none cursor-pointer w-full"
              value={activeClientId}
              onChange={(e) => onClientChange(e.target.value)}
            >
              {clients.map((c: Client) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={
                  "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors " +
                  (isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")
                }
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer controls */}
        <div className="px-4 py-3 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={cycleTheme}>
            <ThemeIcon className="w-4 h-4" />
            <span className="text-xs capitalize">{theme} theme</span>
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">M</div>
            <span className="font-bold text-lg">Midas</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-sm"
              value={activeClientId}
              onChange={(e) => onClientChange(e.target.value)}
            >
              {clients.map((c: Client) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cycleTheme}>
              <ThemeIcon className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="lg:hidden flex items-center gap-1 px-3 py-2 border-b border-border overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors " +
                  (isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50")
                }
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>

        <DuckyFooter />
      </div>
    </div>
  );
}
