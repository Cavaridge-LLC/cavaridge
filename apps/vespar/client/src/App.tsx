import { Component, type ReactNode } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AuthCallback } from "@cavaridge/auth/client";
import { ThemeProvider } from "@/lib/theme";
import VesparLayout from "@/components/vespar-layout";
import Dashboard from "@/pages/dashboard";
import ProjectDetail from "@/pages/project-detail";
import Landing from "@/pages/landing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import NotFound from "@/pages/not-found";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-primary)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Loading VESPAR...</p>
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
    <VesparLayout>
      <Router />
    </VesparLayout>
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
