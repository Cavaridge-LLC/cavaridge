import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, MapPin, Zap, ArrowRight, Mail, Lock } from "lucide-react";
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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-md">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground leading-tight">Midas</h1>
              <p className="text-xs text-muted-foreground font-medium">IT Roadmap & QBR Platform</p>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)}>Sign In</Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        {showForm ? (
          <div className="w-full max-w-[400px] bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 text-center">Sign in to Midas</h2>

            <div className="space-y-2 mb-4">
              <Button type="button" variant="outline" className="w-full" disabled={!!oauthLoading} onClick={handleGoogle}>
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {oauthLoading === "google" ? "Redirecting..." : "Sign in with Google"}
              </Button>
              <Button type="button" variant="outline" className="w-full" disabled={!!oauthLoading} onClick={handleMicrosoft}>
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
        ) : (
          <>
            <div className="text-center max-w-2xl mx-auto">
              <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-8">
                <BarChart3 className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-4xl font-bold text-foreground tracking-tight mb-4">
                Strategic IT Roadmaps &<br />Executive Business Reviews
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
                Build client-facing IT roadmaps, track initiatives by quarter,
                and deliver polished QBR presentations — all in one platform.
              </p>
              <Button size="lg" className="px-8 py-6 text-base" onClick={() => setShowForm(true)}>
                Get Started
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-20">
              <div className="bg-card rounded-xl p-6 border border-border">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Quarterly Roadmaps</h3>
                <p className="text-sm text-muted-foreground">
                  Drag-and-drop initiative planning across quarters. Prioritize by team, cost, and business impact.
                </p>
              </div>
              <div className="bg-card rounded-xl p-6 border border-border">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Executive Snapshots</h3>
                <p className="text-sm text-muted-foreground">
                  Engagement scores, risk levels, budget tracking, and adoption metrics at a glance.
                </p>
              </div>
              <div className="bg-card rounded-xl p-6 border border-border">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Board-Ready QBRs</h3>
                <p className="text-sm text-muted-foreground">
                  Generate polished PowerPoint board packs with AI-powered executive summaries.
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Cavaridge, LLC
      </footer>
    </div>
  );
}
