import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Calculator,
  BarChart3,
  Clock,
  Users,
  CalendarDays,
  ClipboardList,
  ArrowRight,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useTheme } from "next-themes";
import { BRANDING } from "@shared/branding";

interface ToolCard {
  title: string;
  tagline: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  category: string;
  available: boolean;
}

const tools: ToolCard[] = [
  {
    title: "60-Day Frequency Calculator",
    tagline: "The gold standard for visit planning",
    description:
      "Calculate Medicare home health visit frequencies based on SOC date. Visual weekly grid, smart scheduling, EMR scan, and calendar export.",
    href: "/tools/frequency-calculator",
    icon: <CalendarDays className="w-6 h-6" />,
    category: "Scheduling",
    available: true,
  },
  {
    title: "Over-Utilization Calculator",
    tagline: "Stay ahead of LUPA and audits",
    description:
      "Analyze visit patterns against CMS thresholds. Identify LUPA risk, front-loading compliance, and documentation red flags.",
    href: "/tools/utilization-calculator",
    icon: <BarChart3 className="w-6 h-6" />,
    category: "Compliance",
    available: true,
  },
];

const comingSoon = [
  {
    title: "OASIS Timing Assistant",
    description: "Track OASIS assessment windows and deadlines.",
    icon: <Clock className="w-5 h-5" />,
  },
  {
    title: "Discipline Coordination Planner",
    description: "Multi-discipline visit scheduling across PT, OT, ST, MSW, HHA.",
    icon: <Users className="w-5 h-5" />,
  },
  {
    title: "Compliance Checklist Builder",
    description: "Generate documentation checklists from visit frequency plans.",
    icon: <ClipboardList className="w-5 h-5" />,
  },
];

const audiences = [
  {
    label: "Clinicians",
    description: "Field nurses and therapists planning patient visits",
    icon: <Activity className="w-5 h-5" />,
  },
  {
    label: "Schedulers",
    description: "Scheduling coordinators managing caseloads",
    icon: <CalendarDays className="w-5 h-5" />,
  },
  {
    label: "Clinical Managers",
    description: "DONs and supervisors ensuring compliance",
    icon: <Calculator className="w-5 h-5" />,
  },
];

export default function Welcome() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      {/* Theme toggle — top right */}
      <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
        <Button
          variant={theme === "light" ? "default" : "outline"}
          size="icon"
          className="rounded-full h-8 w-8"
          onClick={() => setTheme("light")}
          title="Light theme"
        >
          <Sun className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={theme === "dark" ? "default" : "outline"}
          size="icon"
          className="rounded-full h-8 w-8"
          onClick={() => setTheme("dark")}
          title="Dark theme"
        >
          <Moon className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={theme === "system" ? "default" : "outline"}
          size="icon"
          className="rounded-full h-8 w-8"
          onClick={() => setTheme("system")}
          title="System theme"
        >
          <Monitor className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Hero */}
      <section className="px-4 pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Badge variant="secondary" className="text-xs font-medium px-3 py-1">
            Free &amp; Open Access
          </Badge>
          <h1
            className="text-4xl md:text-6xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            {BRANDING.appName}
          </h1>
          <p
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            style={{ fontFamily: "'Source Sans 3', sans-serif" }}
          >
            A gift to the nursing community from {BRANDING.parentCompany}. Clinical
            tools built for the field — no login, no cost, no strings.
          </p>
        </div>
      </section>

      {/* Tool cards */}
      <section className="px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
            Available Tools
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {tools.map((tool) => (
              <Link key={tool.href} href={tool.href} className="group block">
                <Card className="h-full transition-shadow hover:shadow-md border-border">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="bg-primary/10 p-2.5 rounded-lg text-primary">
                        {tool.icon}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {tool.category}
                      </Badge>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                        {tool.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {tool.tagline}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {tool.description}
                    </p>
                    <div className="flex items-center text-sm font-medium text-primary">
                      Open tool
                      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Coming soon */}
      <section className="px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
            Coming Soon
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {comingSoon.map((item) => (
              <Card key={item.title} className="border-dashed opacity-70">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="text-muted-foreground mt-0.5">{item.icon}</div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Audience */}
      <section className="px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
            Built for the Field
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {audiences.map((a) => (
              <div
                key={a.label}
                className="flex items-start gap-3 p-4 rounded-lg bg-muted/50"
              >
                <div className="text-primary mt-0.5">{a.icon}</div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {a.label}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {a.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="px-4 pb-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Ceres is an educational and planning tool. It does not constitute medical advice,
            legal counsel, or official CMS guidance. Always verify visit frequencies against
            current Medicare regulations and your agency's policies.
          </p>
        </div>
      </section>
    </div>
  );
}
