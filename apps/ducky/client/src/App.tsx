import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AuthCallback } from "@cavaridge/auth/client";
import { ThemeProvider } from "@/lib/theme";
import { TourProvider, TourOverlay, TourStepPopover, ChecklistProvider, Checklist } from "@cavaridge/onboarding";
import { duckyTourConfig, duckyChecklistConfig } from "@/config/onboarding";
import DuckyLayout from "@/components/ducky-layout";
import HomePage from "@/pages/home";
import AskPage from "@/pages/ask";
import KnowledgePage from "@/pages/knowledge";
import SavedPage from "@/pages/saved";
import SettingsPage from "@/pages/settings";
import AdminPage from "@/pages/admin";
import AnalyticsPage from "@/pages/analytics";
import BuildPage from "@/pages/build";
import Landing from "@/pages/landing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/ask" component={AskPage} />
      <Route path="/knowledge" component={KnowledgePage} />
      <Route path="/saved" component={SavedPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/build" component={BuildPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--text-secondary)]">Loading Ducky...</p>
        </div>
      </div>
    );
  }

  // OAuth/PKCE callback — must be handled before auth check
  if (location === "/auth/callback") {
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
    <TourProvider config={duckyTourConfig}>
      <ChecklistProvider config={duckyChecklistConfig}>
        <DuckyLayout>
          <Router />
        </DuckyLayout>
        <TourOverlay />
        <TourStepPopover />
        <Checklist onNavigate={setLocation} />
      </ChecklistProvider>
    </TourProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <AuthenticatedApp />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
