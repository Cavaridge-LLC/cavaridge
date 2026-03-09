import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import MigrationWizard from "@/pages/migration-wizard";
import History from "@/pages/history";
import PlanDetail from "@/pages/plan-detail";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/wizard" component={MigrationWizard} />
      <Route path="/history" component={History} />
      <Route path="/plan/:id" component={PlanDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;