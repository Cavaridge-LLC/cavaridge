import { useState, useEffect, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, Lock, User, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";

function PasswordStrength({ password }: { password: string }) {
  const checks = useMemo(() => ({
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  }), [password]);

  const score = Object.values(checks).filter(Boolean).length;
  const colors = ["bg-red-500", "bg-amber-500", "bg-blue-500", "bg-emerald-500"];
  const labels = ["", "Weak", "Fair", "Strong"];

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i < score ? colors[score] : "bg-[var(--theme-border)]"}`} />
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <span className={`text-[10px] font-data ${score >= 3 ? "text-emerald-400" : score >= 2 ? "text-blue-400" : "text-amber-400"}`}>
          {labels[score]}
        </span>
        <div className="flex flex-col gap-0.5 text-[10px]">
          <span className={checks.length ? "text-emerald-400" : "text-gray-500"}>
            {checks.length ? "\u2713" : "\u2717"} 8+ characters
          </span>
          <span className={checks.uppercase ? "text-emerald-400" : "text-gray-500"}>
            {checks.uppercase ? "\u2713" : "\u2717"} 1 uppercase letter
          </span>
          <span className={checks.number ? "text-emerald-400" : "text-gray-500"}>
            {checks.number ? "\u2713" : "\u2717"} 1 number
          </span>
        </div>
      </div>
    </div>
  );
}

export default function InvitePage() {
  const [, params] = useRoute("/invite/:token");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const token = params?.token || "";

  const [inviteData, setInviteData] = useState<{
    email: string;
    role: string;
    organizationName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/invitations/lookup/${token}`)
      .then(async (res) => {
        if (res.status === 410) {
          setError("This invitation has expired. Contact your administrator for a new one.");
          return;
        }
        if (!res.ok) {
          setError("This invitation is no longer valid. Contact your administrator for a new one.");
          return;
        }
        const data = await res.json();
        setInviteData(data);
      })
      .catch(() => setError("Failed to load invitation."))
      .finally(() => setLoading(false));
  }, [token]);

  const isPasswordValid = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      toast({ title: "Password too weak", description: "Password must be 8+ characters with 1 uppercase letter and 1 number", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/invitations/accept", { token, name, password });
      await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Welcome to MERIDIAN", description: "Your account has been created" });
      setLocation("/");
    } catch (err: any) {
      const msg = err.message || "Failed to accept invitation";
      let parsed = msg;
      try { parsed = JSON.parse(msg.split(":").slice(1).join(":").trim())?.message || msg; } catch {}
      toast({ title: "Error", description: parsed, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const displayRole = inviteData?.role === "integration_pm" ? "Integration PM" : inviteData?.role ? inviteData.role.charAt(0).toUpperCase() + inviteData.role.slice(1) : "";

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight font-sans">MERIDIAN</h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">M&A IT Intelligence Platform</p>
        </div>

        <Card className="p-6 border-[var(--theme-border)]" style={{ background: "var(--bg-card)" }}>
          {loading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[var(--text-secondary)]">Loading invitation...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertCircle className="w-10 h-10 text-amber-500" />
              <p className="text-sm text-[var(--text-secondary)]">{error}</p>
              <Button
                data-testid="button-go-login"
                variant="outline"
                className="mt-2 border-[var(--theme-border)] text-[var(--text-secondary)]"
                onClick={() => setLocation("/login")}
              >
                Go to Sign In
              </Button>
            </div>
          )}

          {inviteData && !error && (
            <>
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">You've been invited</h2>
                </div>
                <p className="text-sm text-gray-400">
                  Join <span className="text-[var(--text-primary)] font-medium">{inviteData.organizationName}</span> as{" "}
                  <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400 no-default-hover-elevate no-default-active-elevate">
                    {displayRole}
                  </Badge>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[var(--text-secondary)] text-sm">Email</Label>
                  <Input
                    data-testid="input-invite-email"
                    value={inviteData.email}
                    disabled
                    className="border-[var(--theme-border)] text-gray-400"
                    style={{ background: "var(--bg-panel)" }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[var(--text-secondary)] text-sm">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="name"
                      data-testid="input-invite-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      className="pl-10 border-[var(--theme-border)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
                      style={{ background: "var(--bg-panel)" }}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[var(--text-secondary)] text-sm">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="password"
                      data-testid="input-invite-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      className="pl-10 border-[var(--theme-border)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
                      style={{ background: "var(--bg-panel)" }}
                      required
                    />
                  </div>
                  <PasswordStrength password={password} />
                </div>

                <Button
                  type="submit"
                  data-testid="button-accept-invite"
                  className="w-full bg-blue-600 text-white"
                  disabled={submitting || !name || !isPasswordValid}
                >
                  {submitting ? "Creating account..." : "Accept Invitation"}
                  {!submitting && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
              </form>
            </>
          )}
        </Card>

        <div className="text-center mt-6">
          <span className="text-[11px] font-data text-[var(--text-disabled)]">MERIDIAN v2.0 &copy; 2026</span>
        </div>
      </div>
    </div>
  );
}
