import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AuthCallback } from "@cavaridge/auth/client";
import { TourProvider, TourOverlay, TourStepPopover, ChecklistProvider, Checklist } from "@cavaridge/onboarding";
import { ceresTourConfig, ceresChecklistConfig } from "@/config/onboarding";
import { DuckyFooter } from "@/components/ducky-footer";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Landing from "@/pages/landing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
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
    <TourProvider config={ceresTourConfig}>
      <ChecklistProvider config={ceresChecklistConfig}>
        <Router />
        <TourOverlay />
        <TourStepPopover />
        <Checklist onNavigate={setLocation} />
      </ChecklistProvider>
    </TourProvider>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <AuthenticatedApp />
            <DuckyFooter />
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
