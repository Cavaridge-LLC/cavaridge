import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { DuckyFooter } from "@/components/ducky-footer";
import { useDynamicFavicon, CERES_BRANDING } from "@cavaridge/branding";
import Welcome from "@/pages/Welcome";
import FrequencyCalculator from "@/pages/FrequencyCalculator";
import UtilizationCalculator from "@/pages/UtilizationCalculator";
import NotFound from "@/pages/not-found";

/** Extract the tool slug from a /tools/<slug> route. */
function useToolSlug(): string | undefined {
  const [location] = useLocation();
  const match = location.match(/^\/tools\/(.+?)(?:\/|$)/);
  return match?.[1];
}

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

function DynamicFavicon() {
  const toolSlug = useToolSlug();
  useDynamicFavicon(CERES_BRANDING.favicon, toolSlug);
  return null;
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <DynamicFavicon />
          <Router />
          <DuckyFooter />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
