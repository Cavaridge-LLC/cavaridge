import { useAuth } from "@/hooks/use-auth";
import { BRANDING } from "@shared/branding";
import ThemeToggle from "@/components/ThemeToggle";
import { Shield } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Profile */}
      <div className="bg-card rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold">Profile</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground">Email</label>
            <p className="font-medium">{user?.email || "dev@hipaa.local"}</p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Display Name</label>
            <p className="font-medium">{user?.displayName || user?.email?.split("@")[0] || "User"}</p>
          </div>
        </div>
      </div>

      {/* Theme */}
      <div className="bg-card rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold">Appearance</h2>
        <div>
          <label className="text-sm text-muted-foreground">Theme</label>
          <div className="mt-2">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* About */}
      <div className="bg-card rounded-xl border p-6 space-y-3">
        <h2 className="font-semibold">About</h2>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-medium">{BRANDING.appName}</span>
        </div>
        <p className="text-sm text-muted-foreground">{BRANDING.appTagline}</p>
        <p className="text-sm text-muted-foreground">{BRANDING.parentCompany}</p>
        <p className="text-xs text-muted-foreground mt-4">{BRANDING.duckyFooter}</p>
      </div>
    </div>
  );
}
