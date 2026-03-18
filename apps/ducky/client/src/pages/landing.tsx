import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Zap, BookOpen, Bookmark, Lock, Mail, ArrowRight, UserPlus } from "lucide-react";
import { DuckyLogo } from "@/components/ducky-logo";

export default function Landing() {
  const { signIn, signUp, signInWithGoogle, signInWithMicrosoft } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "microsoft" | null>(null);
  const [error, setError] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isRegister) {
        await signUp(email, password, name, orgName || undefined);
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setOauthLoading("google");
    setError("");
    try { await signInWithGoogle(); } catch { setOauthLoading(null); }
  };

  const handleMicrosoft = async () => {
    setOauthLoading("microsoft");
    setError("");
    try { await signInWithMicrosoft(); } catch { setOauthLoading(null); }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--theme-border)] sticky top-0 z-10 bg-[var(--bg-primary)]">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <DuckyLogo size="sm" />
            </div>
            <div>
              <h1 className="font-semibold text-[var(--text-primary)] leading-tight">Ducky</h1>
              <p className="text-xs text-[var(--text-secondary)] font-medium">Intelligence by Cavaridge</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            Sign In
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        {showForm ? (
          /* Auth form */
          <div className="w-full max-w-[400px] bg-[var(--bg-card)] rounded-xl border border-[var(--theme-border)] p-6">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4 text-center">
              {isRegister ? "Create your account" : "Sign in to Ducky"}
            </h2>

            {/* OAuth buttons */}
            <div className="space-y-2 mb-4">
              <button
                type="button"
                disabled={!!oauthLoading}
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {oauthLoading === "google" ? "Redirecting..." : "Sign in with Google"}
              </button>
              <button
                type="button"
                disabled={!!oauthLoading}
                onClick={handleMicrosoft}
                className="w-full flex items-center justify-center gap-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 21 21">
                  <rect fill="#F25022" x="1" y="1" width="9" height="9" />
                  <rect fill="#7FBA00" x="11" y="1" width="9" height="9" />
                  <rect fill="#00A4EF" x="1" y="11" width="9" height="9" />
                  <rect fill="#FFB900" x="11" y="11" width="9" height="9" />
                </svg>
                {oauthLoading === "microsoft" ? "Redirecting..." : "Sign in with Microsoft"}
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 border-t border-[var(--theme-border)]" />
              <span className="text-xs text-[var(--text-disabled)]">or</span>
              <div className="flex-1 border-t border-[var(--theme-border)]" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
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
                        className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
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
                      className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
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
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
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
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {error && <p className="text-xs text-red-400 text-center">{error}</p>}

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

            <div className="text-center mt-3">
              <button
                onClick={() => { setIsRegister(!isRegister); setError(""); }}
                className="text-xs text-[var(--text-secondary)] hover:text-amber-500 transition-colors"
              >
                {isRegister ? "Already have an account? Sign in" : "Need an account? Create one"}
              </button>
            </div>

            <button
              type="button"
              className="mt-3 w-full text-center text-xs text-[var(--text-disabled)] hover:text-[var(--text-secondary)]"
              onClick={() => setShowForm(false)}
            >
              Back
            </button>
          </div>
        ) : (
          /* Hero + features */
          <>
            <div className="text-center max-w-2xl mx-auto">
              <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-8">
                <DuckyLogo size="xl" />
              </div>
              <h2 className="text-4xl font-bold text-[var(--text-primary)] tracking-tight mb-4">
                Ducky Intelligence
              </h2>
              <p className="text-lg text-[var(--text-secondary)] mb-8 max-w-lg mx-auto">
                Ask anything. Get instant, accurate answers powered by your organization's
                knowledge base. Save, share, and build on what you learn.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="px-8 py-3 bg-amber-500 text-white rounded-lg font-medium text-base hover:bg-amber-600 transition-colors"
              >
                Get Started
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-20">
              <div className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--theme-border)]">
                <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">Instant Answers</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Ask questions in natural language and get precise, sourced answers in seconds.
                </p>
              </div>
              <div className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--theme-border)]">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-4">
                  <BookOpen className="w-5 h-5 text-emerald-500" />
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">Knowledge Management</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Connect your docs, wikis, and data sources. Ducky learns from everything your team knows.
                </p>
              </div>
              <div className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--theme-border)]">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
                  <Bookmark className="w-5 h-5 text-blue-500" />
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">Save & Share</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Bookmark answers, build collections, and share knowledge across your organization.
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-[var(--theme-border)] py-6 text-center text-sm text-[var(--text-disabled)]">
        <p className="text-[10px] text-[var(--text-disabled)] mb-1">Powered by Ducky Intelligence</p>
        &copy; {new Date().getFullYear()} Cavaridge, LLC
      </footer>
    </div>
  );
}
