import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Lock, Mail, ArrowRight, Shield, UserPlus, KeyRound } from "lucide-react";
import { useLocation } from "wouter";

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const { data: versionData } = useQuery<{ version: string }>({ queryKey: ["/api/version"] });
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<"request" | "reset">("request");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotToken, setForgotToken] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

  const handleForgotOpen = () => {
    setForgotStep("request");
    setForgotEmail("");
    setForgotToken("");
    setForgotNewPassword("");
    setForgotMessage("");
    setForgotOpen(true);
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage("");
    try {
      await apiRequest("POST", "/api/auth/request-password-reset", { email: forgotEmail });
      setForgotMessage("If an account exists, a reset link has been sent. Check your email for the reset token.");
      setForgotStep("reset");
    } catch (err: any) {
      setForgotMessage("If an account exists, a reset link will be sent.");
      setForgotStep("reset");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage("");
    try {
      await apiRequest("POST", "/api/auth/reset-password", { token: forgotToken, password: forgotNewPassword });
      setForgotMessage("Password reset successfully. Please log in.");
      toast({ title: "Password Reset", description: "Password reset successfully. Please log in." });
      setTimeout(() => setForgotOpen(false), 2000);
    } catch (err: any) {
      const msg = err.message?.includes(":") ? err.message.split(":").slice(1).join(":").trim() : err.message;
      let parsed = msg;
      try { parsed = JSON.parse(msg)?.message || msg; } catch {}
      setForgotMessage(parsed || "Failed to reset password.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast({ title: "Welcome back", description: "Successfully signed in" });
    } catch (err: any) {
      const msg = err.message?.includes(":") ? err.message.split(":").slice(1).join(":").trim() : err.message;
      let parsed = msg;
      try { parsed = JSON.parse(msg)?.message || msg; } catch {}
      toast({ title: "Login failed", description: parsed, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
      <div className="w-full max-w-[420px] px-4">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight font-data">MERIDIAN</h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">M&A IT Intelligence Platform</p>
        </div>

        <Card className="p-6 border-[var(--theme-border)]" style={{ background: "var(--bg-card)" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[var(--text-secondary)] text-sm">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-disabled)]" />
                <Input
                  id="email"
                  data-testid="input-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="pl-10 border-[var(--theme-border)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
                  style={{ background: "var(--bg-panel)" }}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[var(--text-secondary)] text-sm">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-disabled)]" />
                <Input
                  id="password"
                  data-testid="input-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="pl-10 border-[var(--theme-border)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
                  style={{ background: "var(--bg-panel)" }}
                  required
                />
              </div>
            </div>

            <div className="text-right">
              <button
                type="button"
                data-testid="link-forgot-password"
                className="text-xs text-[var(--text-disabled)] hover:text-[var(--text-secondary)] transition-colors"
                onClick={handleForgotOpen}
              >
                Forgot your password?
              </button>
            </div>

            <Button
              type="submit"
              data-testid="button-submit"
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? "Please wait..." : "Sign In"}
              {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[var(--theme-border)]" />
            <span className="text-xs text-[var(--text-disabled)]">or</span>
            <div className="flex-1 h-px bg-[var(--theme-border)]" />
          </div>

          <Button
            variant="outline"
            data-testid="button-request-access"
            className="w-full border-[var(--theme-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            onClick={() => setLocation("/request-access")}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Request Access
          </Button>
        </Card>

        <div className="text-center mt-6">
          <span className="text-[11px] font-data text-[var(--text-disabled)]" data-testid="text-version-footer">MERIDIAN v{versionData?.version || "..."}</span>
        </div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="border-[var(--theme-border)]" style={{ background: "var(--bg-card)" }}>
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)] flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-500" />
              {forgotStep === "request" ? "Reset Password" : "Enter Reset Token"}
            </DialogTitle>
            <DialogDescription className="text-[var(--text-secondary)]">
              {forgotStep === "request"
                ? "Enter your email address to receive a password reset token."
                : "Enter the reset token and your new password."}
            </DialogDescription>
          </DialogHeader>

          {forgotMessage && (
            <div
              data-testid="text-forgot-message"
              className="text-sm p-3 rounded-md border border-[var(--theme-border)]"
              style={{ background: "var(--bg-panel)" }}
            >
              <p className="text-[var(--text-secondary)]">{forgotMessage}</p>
            </div>
          )}

          {forgotStep === "request" ? (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-[var(--text-secondary)] text-sm">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-disabled)]" />
                  <Input
                    id="forgot-email"
                    data-testid="input-forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="pl-10 border-[var(--theme-border)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
                    style={{ background: "var(--bg-panel)" }}
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                data-testid="button-request-reset"
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
                disabled={forgotLoading}
              >
                {forgotLoading ? "Sending..." : "Request Reset"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-token" className="text-[var(--text-secondary)] text-sm">Reset Token</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-disabled)]" />
                  <Input
                    id="reset-token"
                    data-testid="input-reset-token"
                    type="text"
                    value={forgotToken}
                    onChange={(e) => setForgotToken(e.target.value)}
                    placeholder="Paste reset token"
                    className="pl-10 border-[var(--theme-border)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
                    style={{ background: "var(--bg-panel)" }}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-[var(--text-secondary)] text-sm">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-disabled)]" />
                  <Input
                    id="new-password"
                    data-testid="input-new-password"
                    type="password"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="pl-10 border-[var(--theme-border)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
                    style={{ background: "var(--bg-panel)" }}
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                data-testid="button-reset-password"
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
                disabled={forgotLoading}
              >
                {forgotLoading ? "Resetting..." : "Reset Password"}
              </Button>
              <button
                type="button"
                data-testid="link-back-to-request"
                className="w-full text-center text-xs text-[var(--text-disabled)] hover:text-[var(--text-secondary)] transition-colors"
                onClick={() => {
                  setForgotStep("request");
                  setForgotMessage("");
                  setReturnedToken("");
                }}
              >
                Use a different email
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
