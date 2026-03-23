import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { DuckyFooter } from "@/components/ducky-footer";
import Welcome from "@/pages/Welcome";
import FrequencyCalculator from "@/pages/FrequencyCalculator";
import UtilizationCalculator from "@/pages/UtilizationCalculator";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Welcome} />
      <Route path="/tools/frequency-calculator" component={FrequencyCalculator} />
      <Route path="/tools/utilization-calculator" component={UtilizationCalculator} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
          <DuckyFooter />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
