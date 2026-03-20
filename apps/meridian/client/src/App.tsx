import * as Sentry from "@sentry/react";
import { Component, type ReactNode } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AuthCallback } from "@cavaridge/auth/client";
import { ThemeProvider } from "@/lib/theme";
import { TourProvider, TourOverlay, TourStepPopover, ChecklistProvider, Checklist } from "@cavaridge/onboarding";
import { meridianTourConfig, meridianChecklistConfig } from "@/config/onboarding";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import MeridianLayout from "@/components/meridian-layout";
import PipelinePage from "@/pages/pipeline";
import RiskPage from "@/pages/risk";
import AskAiPage from "@/pages/ask-ai";
import InfraPage from "@/pages/infra";
import PlaybookPage from "@/pages/playbook";
import SimulatorPage from "@/pages/simulator";
import PortfolioPage from "@/pages/portfolio";
import Landing from "@/pages/landing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import InvitePage from "@/pages/invite";
import RequestAccessPage from "@/pages/request-access";
import PlatformAdminPage from "@/pages/platform-admin";
import SettingsPage from "@/pages/settings";
import ReportsPage from "@/pages/reports";
import KnowledgeGraphPage from "@/pages/knowledge-graph";
import NotFound from "@/pages/not-found";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", fontFamily: "system-ui", maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{ color: "#EF4444", marginBottom: "16px" }}>Something went wrong</h2>
          <pre style={{
            background: "#1a1a2e",
            color: "#e0e0e0",
            padding: "16px",
            borderRadius: "8px",
            fontSize: "12px",
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}>
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              marginTop: "16px",
              padding: "8px 16px",
              background: "#3B82F6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function WrappedAskAi() { return <PageErrorBoundary pageName="Ask MERIDIAN"><AskAiPage /></PageErrorBoundary>; }
function WrappedInfra() { return <PageErrorBoundary pageName="Infrastructure"><InfraPage /></PageErrorBoundary>; }
function WrappedPlaybook() { return <PageErrorBoundary pageName="Playbook"><PlaybookPage /></PageErrorBoundary>; }
function WrappedSimulator() { return <PageErrorBoundary pageName="Simulator"><SimulatorPage /></PageErrorBoundary>; }
function WrappedReports() { return <PageErrorBoundary pageName="Reports"><ReportsPage /></PageErrorBoundary>; }
function WrappedPlatformAdmin() { return <PageErrorBoundary pageName="Platform Admin"><PlatformAdminPage /></PageErrorBoundary>; }
function WrappedKnowledgeGraph() { return <PageErrorBoundary pageName="Knowledge Graph"><KnowledgeGraphPage /></PageErrorBoundary>; }

function Router() {
  return (
    <Switch>
      <Route path="/" component={PipelinePage} />
      <Route path="/risk" component={RiskPage} />
      <Route path="/ask-ai" component={WrappedAskAi} />
      <Route path="/infra" component={WrappedInfra} />
      <Route path="/playbook" component={WrappedPlaybook} />
      <Route path="/simulator" component={WrappedSimulator} />
      <Route path="/portfolio" component={PortfolioPage} />
      <Route path="/reports" component={WrappedReports} />
      <Route path="/knowledge-graph" component={WrappedKnowledgeGraph} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/platform-admin" component={WrappedPlatformAdmin} />
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
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--text-secondary)]">Loading MERIDIAN...</p>
        </div>
      </div>
    );
  }

  // OAuth/PKCE callback — must be handled before auth check
  if (location === "/auth/callback") {
    return <AuthCallback />;
  }

  if (location.startsWith("/invite/")) {
    return <InvitePage />;
  }

  if (location === "/request-access") {
    return <RequestAccessPage />;
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
    <TourProvider config={meridianTourConfig}>
      <ChecklistProvider config={meridianChecklistConfig}>
        <MeridianLayout>
          <Router />
        </MeridianLayout>
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
              <AuthenticatedApp />
            </AuthProvider>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
