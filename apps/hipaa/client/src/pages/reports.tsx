import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import DuckyMascot from "@/components/DuckyMascot";
import { FileText, ArrowRight } from "lucide-react";

export default function ReportsPage() {
  const { data: assessmentsData } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => apiRequest("/api/assessments"),
  });

  const assessments = assessmentsData?.assessments || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>
      <p className="text-muted-foreground">Generate and view compliance reports for your assessments.</p>

      {assessments.length === 0 ? (
        <div className="bg-card rounded-xl border p-8 text-center">
          <DuckyMascot state="idle" />
          <p className="mt-4 text-muted-foreground">No assessments to report on yet.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border divide-y">
          {assessments.map((a: any) => (
            <Link key={a.id} href={`/assessments/${a.id}`}>
              <div className="p-4 flex items-center justify-between hover:bg-muted/50 transition cursor-pointer">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.framework?.replace("_", " ")} &middot; {a.status?.replace("_", " ")}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
