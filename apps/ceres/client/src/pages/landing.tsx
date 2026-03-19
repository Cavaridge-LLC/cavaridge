import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, ArrowRight, FileImage, Clock, Activity } from "lucide-react";
import { DuckyMascot } from "@/components/DuckyMascot";
import { BRANDING } from "@shared/branding";

export default function Landing() {
  const { signIn, signUp, signInWithGoogle, signInWithMicrosoft, isLoading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [showAuth, setShowAuth] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (isSignUp) {
        await signUp(email, password, displayName);
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    }
  }

  if (showAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 text-white mb-4">
              <Calendar className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{BRANDING.appName}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{BRANDING.appDescription}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 space-y-6">
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-11"
                onClick={() => signInWithGoogle?.()}
                disabled={isLoading}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </Button>
              <Button
                variant="outline"
                className="w-full h-11"
                onClick={() => signInWithMicrosoft?.()}
                disabled={isLoading}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#F25022" d="M1 1h10v10H1z" />
                  <path fill="#00A4EF" d="M1 13h10v10H1z" />
                  <path fill="#7FBA00" d="M13 1h10v10H13z" />
                  <path fill="#FFB900" d="M13 13h10v10H13z" />
                </svg>
                Continue with Microsoft
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-gray-800 px-2 text-gray-500">or</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Full Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700" disabled={isLoading}>
                {isLoading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500">
              {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
              <button
                type="button"
                className="text-emerald-600 hover:underline font-medium"
                onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 mt-6">
            <DuckyMascot state="idle" size="sm" />
            <span className="text-xs text-gray-400">{BRANDING.duckyFooter}</span>
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">&copy; {new Date().getFullYear()} {BRANDING.parentCompany}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-gray-900 dark:to-gray-800">
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <Calendar className="w-7 h-7 text-emerald-600" />
          <span className="text-xl font-bold text-gray-900 dark:text-white">{BRANDING.appName}</span>
          <DuckyMascot state="idle" size="sm" />
        </div>
        <Button variant="outline" onClick={() => setShowAuth(true)}>Sign In</Button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
          Home Health Schedule Analyzer
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto">
          Upload EMR schedule screenshots and instantly extract visit patterns, SOC dates, and compliance metrics for home health agencies.
        </p>
        <Button
          size="lg"
          className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 h-12"
          onClick={() => setShowAuth(true)}
        >
          Get Started <ArrowRight className="ml-2 w-5 h-5" />
        </Button>

        <div className="grid md:grid-cols-3 gap-6 mt-20 text-left">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <FileImage className="w-8 h-8 text-emerald-600 mb-3" />
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Image Recognition</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">AI-powered analysis of EMR schedule screenshots from WellSky, HCHB, Axxess, and more.</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <Clock className="w-8 h-8 text-emerald-600 mb-3" />
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Visit Tracking</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Automatic extraction of visit dates, SOC identification, and weekly distribution analysis.</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <Activity className="w-8 h-8 text-emerald-600 mb-3" />
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Compliance Metrics</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">60-day episode tracking with front-loaded visit pattern validation.</p>
          </div>
        </div>
      </main>

      <footer className="text-center py-8 space-y-2">
        <div className="flex items-center justify-center gap-2">
          <DuckyMascot state="idle" size="sm" />
          <span className="text-sm font-medium text-gray-400">{BRANDING.duckyFooter}</span>
        </div>
        <p className="text-xs text-gray-400">
          &copy; {new Date().getFullYear()} {BRANDING.parentCompany}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
