import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart3, Construction } from "lucide-react";

export default function UtilizationCalculator() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          All Tools
        </Link>

        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-3 rounded-xl text-primary">
            <BarChart3 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Over-Utilization Calculator
            </h1>
            <p className="text-muted-foreground mt-1">
              Analyze visit patterns against CMS thresholds
            </p>
          </div>
        </div>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Construction className="w-5 h-5 text-amber-500" />
              Under Construction
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              The Over-Utilization Calculator is being built. When complete, it will help you:
            </p>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>Identify LUPA (Low Utilization Payment Adjustment) risk before it impacts reimbursement</li>
              <li>Evaluate front-loading compliance against PDGM expectations</li>
              <li>Flag documentation red flags that could trigger audits</li>
              <li>Compare your visit patterns to CMS benchmarks by discipline</li>
            </ul>
            <div className="pt-2">
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
