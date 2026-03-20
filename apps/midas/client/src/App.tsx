import { useEffect, useState } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { TourProvider, TourOverlay, TourStepPopover, ChecklistProvider, Checklist } from "@cavaridge/onboarding";
import { midasTourConfig, midasChecklistConfig } from "@/config/onboarding";
import { AppLayout } from "@/components/layout/AppLayout";
import { clientsQuery, useSeed } from "@/lib/api";
import NotFound from "@/pages/not-found";
import Roadmap from "@/pages/Roadmap";
import QBR from "@/pages/QBR";
import SecurityScore from "@/pages/SecurityScore";
import Controls from "@/pages/Controls";
import Landing from "@/pages/landing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import { Loader2 } from "lucide-react";
import type { Client } from "@shared/schema";

function AuthenticatedRouter() {
  const { data: clients = [], isLoading: loadingClients } = useQuery(clientsQuery());
  const seedMutation = useSeed();
  const [activeClientId, setActiveClientId] = useState<string>("");
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (clients.length > 0 && !activeClientId) {
      setActiveClientId(clients[0].id);
    }
  }, [clients, activeClientId]);

  useEffect(() => {
    if (!loadingClients && clients.length === 0) {
      seedMutation.mutate();
    }
  }, [loadingClients, clients.length]);

  if (loadingClients) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <TourProvider config={midasTourConfig}>
      <ChecklistProvider config={midasChecklistConfig}>
        <AppLayout activeClientId={activeClientId} onClientChange={setActiveClientId}>
          <Switch>
            <Route path="/">
              <Roadmap clientId={activeClientId} />
            </Route>
            <Route path="/security">
              <SecurityScore clientId={activeClientId} />
            </Route>
            <Route path="/qbr">
              <QBR clientId={activeClientId} />
            </Route>
            <Route path="/controls">
              <Controls clientId={activeClientId} />
            </Route>
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
        <TourOverlay />
        <TourStepPopover />
        <Checklist onNavigate={setLocation} />
      </ChecklistProvider>
    </TourProvider>
  );
}

function AppContent() {
  const { isLoading, isAuthenticated } = useAuth();
  const [location] = useLocation();

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

  return <AuthenticatedRouter />;
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <AppContent />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
