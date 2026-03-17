import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Shield, Target, ShieldAlert, BookOpen,
  Lock, Mail, ArrowRight, UserPlus, KeyRound,
} from "lucide-react";

export default function Landing() {
  const { login, signInWithGoogle, signInWithMicrosoft, resetPassword } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: versionData } = useQuery<{ version: string }>({ queryKey: ["/api/version"] });

  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
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
    try { await signInWithGoogle(); } catch (err: any) {
      toast({ title: "Google sign-in failed", description: err.message, variant: "destructive" });
      setOauthLoading(null);
    }
  };

  const handleMicrosoftSignIn = async () => {
    setOauthLoading("microsoft");
    try { await signInWithMicrosoft(); } catch (err: any) {
      toast({ title: "Microsoft sign-in failed", description: err.message, variant: "destructive" });
      setOauthLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--theme-border)] sticky top-0 z-10 bg-[var(--bg-primary)]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-7 h-7 text-blue-500" />
            <div>
              <h1 className="font-bold text-[var(--text-primary)] tracking-tight font-data leading-tight">MERIDIAN</h1>
              <p className="text-xs text-[var(--text-secondary)] font-medium">M&A IT Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="border-[var(--theme-border)] text-[var(--text-secondary)]"
              onClick={() => setLocation("/request-access")}
            >
              Request Access
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowForm(true)}>
              Sign In
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        {showForm ? (
          /* Auth form */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-[420px] bg-[var(--bg-card)] rounded-xl border border-[var(--theme-border)] p-6"
          >
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4 text-center">
              Sign in to MERIDIAN
            </h2>

            {/* OAuth buttons */}
            <div className="space-y-2 mb-4">
              <Button
                type="button" variant="outline" className="w-full border-[var(--theme-border)]"
                disabled={!!oauthLoading} onClick={handleGoogleSignIn}
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
                type="button" variant="outline" className="w-full border-[var(--theme-border)]"
                disabled={!!oauthLoading} onClick={handleMicrosoftSignIn}
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

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="email" className="text-sm text-[var(--text-secondary)]">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-disabled)]" />
                  <Input
                    id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com" className="pl-10 border-[var(--theme-border)]"
                    style={{ background: "var(--bg-panel)" }} required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="password" className="text-sm text-[var(--text-secondary)]">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-disabled)]" />
                  <Input
                    id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password" className="pl-10 border-[var(--theme-border)]"
                    style={{ background: "var(--bg-panel)" }} required
                  />
                </div>
              </div>

              <div className="text-right">
                <button
                  type="button"
                  className="text-xs text-[var(--text-disabled)] hover:text-[var(--text-secondary)] transition-colors"
                  onClick={handleForgotOpen}
                >
                  Forgot your password?
                </button>
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
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
              className="w-full border-[var(--theme-border)] text-[var(--text-secondary)]"
              onClick={() => setLocation("/request-access")}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Request Access
            </Button>

            <button
              type="button"
              className="mt-3 w-full text-center text-xs text-[var(--text-disabled)] hover:text-[var(--text-secondary)]"
              onClick={() => setShowForm(false)}
            >
              Back
            </button>
          </motion.div>
        ) : (
          /* Hero + features */
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-2xl mx-auto"
            >
              <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-8">
                <Shield className="w-10 h-10 text-blue-500" />
              </div>
              <h2 className="text-4xl font-bold text-[var(--text-primary)] tracking-tight mb-4">
                M&A IT Intelligence Platform
              </h2>
              <p className="text-lg text-[var(--text-secondary)] mb-4 max-w-lg mx-auto">
                Manage deal pipelines, automate IT due diligence, and surface risks before
                they become problems. Purpose-built for M&A IT integration teams.
              </p>
              <p className="text-sm text-[var(--text-disabled)] mb-8">
                Powered by Ducky Intelligence
              </p>
              <div className="flex items-center justify-center gap-4">
                <Button size="lg" className="px-8 bg-blue-600 hover:bg-blue-700" onClick={() => setShowForm(true)}>
                  Get Started
                </Button>
                <Button size="lg" variant="outline" className="px-8 border-[var(--theme-border)]" onClick={() => setLocation("/request-access")}>
                  Request Access
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-20"
            >
              <div className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--theme-border)]">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
                  <Target className="w-5 h-5 text-blue-500" />
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">Deal Pipeline</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Track every deal from LOI through close. Manage phases, milestones,
                  and team assignments in a unified pipeline view.
                </p>
              </div>
              <div className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--theme-border)]">
                <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center mb-4">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">AI-Powered Risk Analysis</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Upload diligence documents and let AI surface critical risks,
                  compliance gaps, and infrastructure concerns automatically.
                </p>
              </div>
              <div className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--theme-border)]">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-4">
                  <BookOpen className="w-5 h-5 text-emerald-500" />
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">Playbooks & Simulator</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Run integration playbooks and simulate Day 1 readiness with
                  pre-built templates tailored to M&A IT scenarios.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </main>

      <footer className="border-t border-[var(--theme-border)] py-4 text-center">
        <p className="text-xs text-[var(--text-disabled)]">Powered by Ducky Intelligence</p>
        <p className="text-sm text-[var(--text-disabled)] mt-1">&copy; {new Date().getFullYear()} Cavaridge, LLC</p>
        <p className="text-xs font-data text-[var(--text-disabled)] mt-1">
          MERIDIAN v{versionData?.version || "..."}
        </p>
      </footer>

      {/* Password reset dialog */}
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
                  id="forgot-email" type="email" value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="pl-10 border-[var(--theme-border)]"
                  style={{ background: "var(--bg-panel)" }} required
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={forgotLoading}>
              {forgotLoading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
