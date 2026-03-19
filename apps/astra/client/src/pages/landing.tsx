import { useState } from "react";
import {
  Shield,
  BarChart3,
  Zap,
  ArrowRight,
  CheckCircle2,
  Users,
  FileText,
  Lock,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

export default function Landing() {
  const { login, signInWithGoogle, signInWithMicrosoft } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "microsoft" | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setOauthLoading("google");
    try { await signInWithGoogle(); } catch { setOauthLoading(null); }
  };

  const handleMicrosoft = async () => {
    setOauthLoading("microsoft");
    try { await signInWithMicrosoft(); } catch { setOauthLoading(null); }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans text-foreground">
      <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold">
              A
            </div>
            <span className="text-xl font-semibold tracking-tight font-display">Astra</span>
          </div>
          <Button size="sm" className="gap-2" data-testid="button-header-login" onClick={() => setShowForm(true)}>
            Sign In
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {showForm ? (
          <section className="py-20 px-6 flex items-center justify-center">
            <div className="w-full max-w-[400px] bg-card rounded-xl border border-border p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4 text-center">Sign in to Astra</h2>

              <div className="space-y-2 mb-4">
                <Button
                  type="button" variant="outline" className="w-full"
                  disabled={!!oauthLoading} onClick={handleGoogle}
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
                  type="button" variant="outline" className="w-full"
                  disabled={!!oauthLoading} onClick={handleMicrosoft}
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
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com" className="pl-10" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password" className="pl-10" required />
                  </div>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Please wait..." : "Sign In"}
                  {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
              </form>

              <button
                type="button"
                className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowForm(false)}
              >
                Back
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="py-20 md:py-32 px-6">
              <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                      <Zap className="h-3.5 w-3.5" />
                      AI-Powered License Intelligence
                    </div>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight leading-[1.1]">
                      Optimize your <span className="text-primary">Microsoft 365</span> licenses with confidence
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                      Astra analyzes your tenant's license assignments and usage patterns, then delivers CIO-level recommendations to cut costs and strengthen security.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button size="lg" className="gap-2 text-base px-6" data-testid="button-hero-login" onClick={() => setShowForm(true)}>
                      Get Started
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Free to use
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Lock className="h-4 w-4 text-green-500" />
                      Read-only access
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-green-500" />
                      Data stays private
                    </div>
                  </div>
                </div>

                <div className="hidden lg:block animate-in fade-in slide-in-from-right-8 duration-700 delay-200">
                  <div className="relative rounded-2xl border border-border/60 bg-card p-6 shadow-xl">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="h-3 w-3 rounded-full bg-red-400" />
                        <div className="h-3 w-3 rounded-full bg-yellow-400" />
                        <div className="h-3 w-3 rounded-full bg-green-400" />
                        <div className="ml-auto text-xs text-muted-foreground font-mono">Astra Dashboard</div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                          <div className="text-xs text-muted-foreground">Active Users</div>
                          <div className="text-xl font-bold font-display">247</div>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                          <div className="text-xs text-muted-foreground">Storage Used</div>
                          <div className="text-xl font-bold font-display">1.8 TB</div>
                        </div>
                        <div className="rounded-lg bg-primary/10 p-3 space-y-1">
                          <div className="text-xs text-muted-foreground">Monthly Cost</div>
                          <div className="text-xl font-bold font-display text-primary">$8,420</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Potential savings (Security strategy)</span>
                          <span className="text-green-500 font-medium">-$1,240/mo</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 w-[72%]" />
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-2">
                        {[
                          { label: "Upgrade 12 users to E5 (Security depts)", color: "bg-blue-500" },
                          { label: "Downgrade 8 underutilized E5 licenses", color: "bg-amber-500" },
                          { label: "Remove 15 redundant add-ons", color: "bg-green-500" },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className={`h-1.5 w-1.5 rounded-full ${item.color}`} />
                            {item.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="py-16 px-6 border-t border-border/40">
              <div className="max-w-6xl mx-auto">
                <div className="text-center mb-12">
                  <h2 className="text-2xl md:text-3xl font-display font-bold mb-3">Everything you need for license optimization</h2>
                  <p className="text-muted-foreground max-w-xl mx-auto">
                    Connect your Microsoft 365 tenant or upload exports. Astra handles the rest.
                  </p>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  {[
                    {
                      icon: BarChart3,
                      title: "Usage-Aware Analysis",
                      desc: "Merges user assignments with mailbox usage data for recommendations based on actual behavior, not just license names.",
                    },
                    {
                      icon: Users,
                      title: "Per-User Recommendations",
                      desc: "Four optimization strategies (Security, Cost, Balanced, Custom) with per-user license change recommendations and cost impact.",
                    },
                    {
                      icon: FileText,
                      title: "Executive Briefings",
                      desc: "AI-generated board-ready reports with risk assessments, implementation roadmaps, and financial projections. Export to PDF.",
                    },
                  ].map((feature, i) => (
                    <div
                      key={i}
                      className="p-6 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                        <feature.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold font-display text-lg mb-2">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border/30 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>&copy; {new Date().getFullYear()} Cavaridge, LLC. All rights reserved.</div>
          <div className="flex items-center gap-1 text-muted-foreground/60">
            <span>Powered by Ducky Intelligence</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
