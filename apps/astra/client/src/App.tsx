import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AuthCallback } from "@cavaridge/auth/client";
import { ThemeProvider } from "@/lib/theme";
import { TourProvider, TourOverlay, TourStepPopover, ChecklistProvider, Checklist } from "@cavaridge/onboarding";
import { astraTourConfig, astraChecklistConfig } from "@/config/onboarding";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import Dashboard from "@/pages/dashboard";
import ExecutiveSummaryPage from "@/pages/executive-summary";
import LicenseComparisonPage from "@/pages/license-comparison";
import { Loader2 } from "lucide-react";
import { Component, type ReactNode } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
            <button className="text-sm text-primary underline" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard}/>
      <Route path="/licenses" component={LicenseComparisonPage}/>
      <Route path="/report/:id/summary" component={ExecutiveSummaryPage}/>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isLoading, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // OAuth/PKCE callback — must be handled before auth check
  if (location === "/auth/callback" || location.startsWith("/auth/callback")) {
    // Once authenticated after code exchange, redirect to dashboard
    if (isAuthenticated) {
      return <Redirect to="/" />;
    }
    return <AuthCallback />;
  }

  // Public auth routes
  const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];
  if (authRoutes.some(r => location === r)) {
    if (isAuthenticated) return <Redirect to="/" />;
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
      </Switch>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <TourProvider config={astraTourConfig}>
      <ChecklistProvider config={astraChecklistConfig}>
        <AuthenticatedRouter />
        <TourOverlay />
        <TourStepPopover />
        <Checklist onNavigate={setLocation} />
      </ChecklistProvider>
    </TourProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AuthProvider>
              <Toaster />
              <AppContent />
            </AuthProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
