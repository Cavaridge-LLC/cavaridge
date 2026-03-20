import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { Toaster } from "sonner";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { useTheme } from "./hooks/use-theme";
import AppShell from "./components/AppShell";
import LandingPage from "./pages/landing";
import DashboardPage from "./pages/dashboard";
import AssessmentWizardPage from "./pages/assessment-wizard";
import AssessmentDetailPage from "./pages/assessment-detail";
import RemediationPage from "./pages/remediation";
import ReportsPage from "./pages/reports";
import CalendarPage from "./pages/calendar";
import SettingsPage from "./pages/settings";
import LoginPage from "./pages/login";
import RegisterPage from "./pages/register";
import ForgotPasswordPage from "./pages/forgot-password";
import ResetPasswordPage from "./pages/reset-password";
import NotFoundPage from "./pages/not-found";
import { Loader2 } from "lucide-react";

function AppRouter() {
  const { user, loading } = useAuth();
  useTheme();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Public auth routes
  const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];
  if (authRoutes.some(r => location === r)) {
    if (user) return <Redirect to="/" />;
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
      </Switch>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/assessments/new" component={AssessmentWizardPage} />
        <Route path="/assessments/:id" component={AssessmentDetailPage} />
        <Route path="/remediation" component={RemediationPage} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFoundPage} />
      </Switch>
    </AppShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
        <Toaster position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
