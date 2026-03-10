import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Lock, Mail, ArrowRight, UserPlus } from "lucide-react";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isRegister) {
        await register(email, password, name, orgName || undefined);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🦆</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Ducky</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">THE AI-native answer engine</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="text-xs text-[var(--text-secondary)] block mb-1">Full Name</label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-disabled)]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-card)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    placeholder="Your name"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)] block mb-1">Organization (optional)</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  placeholder="Your organization"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-disabled)]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-card)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-disabled)]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-card)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 text-white rounded-lg font-medium text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {isRegister ? "Create Account" : "Sign In"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-4">
          <button
            onClick={() => { setIsRegister(!isRegister); setError(""); }}
            className="text-xs text-[var(--text-secondary)] hover:text-amber-500 transition-colors"
          >
            {isRegister ? "Already have an account? Sign in" : "Need an account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}
