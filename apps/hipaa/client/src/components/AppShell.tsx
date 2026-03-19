import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import ThemeToggle from "./ThemeToggle";
import { BRANDING } from "@shared/branding";
import {
  LayoutDashboard, ClipboardCheck, Shield, FileText,
  Calendar, Settings, LogOut, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assessments/new", label: "New Assessment", icon: ClipboardCheck },
  { href: "/remediation", label: "Remediation", icon: AlertTriangle },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <h1 className="font-bold text-sm">{BRANDING.appName}</h1>
              <p className="text-xs text-muted-foreground">{BRANDING.vendorName}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer",
                location === href
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}>
                <Icon className="h-4 w-4" />
                {label}
              </div>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t space-y-3">
          <ThemeToggle />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground truncate">
              {user?.email}
            </span>
            <button
              onClick={() => signOut()}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>

        {/* Ducky footer */}
        <footer className="border-t px-6 py-3 text-center">
          <p className="text-xs text-muted-foreground">
            {BRANDING.duckyFooter}
          </p>
        </footer>
      </div>
    </div>
  );
}
