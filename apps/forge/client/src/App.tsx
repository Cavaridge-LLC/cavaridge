import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { Toaster } from "sonner";
import { Switch, Route } from "wouter";
import { useTheme } from "./hooks/use-theme";
import HomePage from "./pages/home";
import ProjectPage from "./pages/project";
import LandingPage from "./pages/landing";
import NotFoundPage from "./pages/not-found";
import { Loader2 } from "lucide-react";

function AppRouter() {
  const { user, loading } = useAuth();
  useTheme();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/project/:id" component={ProjectPage} />
      <Route component={NotFoundPage} />
    </Switch>
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
