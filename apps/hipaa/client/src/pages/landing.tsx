import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { BRANDING } from "@shared/branding";
import ThemeToggle from "@/components/ThemeToggle";
import DuckyMascot from "@/components/DuckyMascot";
import { Shield, ClipboardCheck, BarChart3, FileText } from "lucide-react";

export default function LandingPage() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, displayName);
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-10 w-10 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">{BRANDING.appName}</h1>
          </div>
          <p className="text-lg text-muted-foreground">{BRANDING.appTagline}</p>
          <DuckyMascot state="idle" size="sm" />
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center text-center p-3 rounded-lg bg-card">
            <ClipboardCheck className="h-6 w-6 text-primary mb-2" />
            <span className="text-xs text-muted-foreground">SRA Wizard</span>
          </div>
          <div className="flex flex-col items-center text-center p-3 rounded-lg bg-card">
            <BarChart3 className="h-6 w-6 text-primary mb-2" />
            <span className="text-xs text-muted-foreground">Gap Analysis</span>
          </div>
          <div className="flex flex-col items-center text-center p-3 rounded-lg bg-card">
            <FileText className="h-6 w-6 text-primary mb-2" />
            <span className="text-xs text-muted-foreground">Reports</span>
          </div>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-xl border">
          <h2 className="text-xl font-semibold text-center">
            {isSignUp ? "Create Account" : "Sign In"}
          </h2>

          {isSignUp && (
            <input
              type="text"
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none"
              required
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none"
            required
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
          </button>

          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition"
          >
            {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">{BRANDING.duckyFooter}</p>
      </div>
    </div>
  );
}
