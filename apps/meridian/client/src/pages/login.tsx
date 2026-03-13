import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail, ArrowRight, Shield, UserPlus, KeyRound } from "lucide-react";
import { useLocation } from "wouter";

export default function LoginPage() {
  const { login, signInWithGoogle, signInWithMicrosoft, resetPassword } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const { data: versionData } = useQuery<{ version: string }>({ queryKey: ["/api/version"] });
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "microsoft" | null>(null);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

  const handleForgotOpen = () => {
    setForgotEmail("");
    setForgotMessage("");
    setForgotOpen(true);
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage("");
    try {
      await resetPassword(forgotEmail);
      setForgotMessage("If an account exists, a password reset link has been sent to your email.");
    } catch {
      setForgotMessage("If an account exists, a password reset link will be sent.");
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
      toast({ title: "Login failed", description: err.message || "Invalid credentials", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading("google");
    try {
      await signInWithGoogle();
    } catch (err: any) {
      toast({ title: "Google sign-in failed", description: err.message, variant: "destructive" });
      setOauthLoading(null);
    }
  };

  const handleMicrosoftSignIn = async () => {
    setOauthLoading("microsoft");
    try {
      await signInWithMicrosoft();
    } catch (err: any) {
      toast({ title: "Microsoft sign-in failed", description: err.message, variant: "destructive" });
      setOauthLoading(null);
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
          {/* OAuth buttons */}
          <div className="space-y-2 mb-4">
            <Button
              type="button"
              variant="outline"
              className="w-full border-[var(--theme-border)] text-[var(--text-primary)] hover:bg-[var(--bg-panel)]"
              disabled={!!oauthLoading}
              onClick={handleGoogleSignIn}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {oauthLoading === "google" ? "Redirecting..." : "Sign in with Google"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-[var(--theme-border)] text-[var(--text-primary)] hover:bg-[var(--bg-panel)]"
              disabled={!!oauthLoading}
              onClick={handleMicrosoftSignIn}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
              {oauthLoading === "microsoft" ? "Redirecting..." : "Sign in with Microsoft"}
            </Button>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[var(--theme-border)]" />
            <span className="text-xs text-[var(--text-disabled)]">or</span>
            <div className="flex-1 h-px bg-[var(--theme-border)]" />
          </div>

          {/* Email/password form */}
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

        <div className="text-center mt-4">
          <span className="text-[10px] text-[var(--text-disabled)]">Cavaridge, LLC</span>
        </div>
        <div className="text-center mt-1">
          <span className="text-[11px] font-data text-[var(--text-disabled)]" data-testid="text-version-footer">MERIDIAN v{versionData?.version || "..."}</span>
        </div>
      </div>

      {/* Password reset dialog — uses Supabase's built-in resetPasswordForEmail */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="border-[var(--theme-border)]" style={{ background: "var(--bg-card)" }}>
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)] flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-500" />
              Reset Password
            </DialogTitle>
            <DialogDescription className="text-[var(--text-secondary)]">
              Enter your email address and we'll send you a link to reset your password.
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
              {forgotLoading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
