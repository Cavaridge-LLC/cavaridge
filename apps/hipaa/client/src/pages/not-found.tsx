import DuckyMascot from "@/components/DuckyMascot";
import { Link } from "wouter";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <DuckyMascot state="concerned" size="lg" />
      <h1 className="text-2xl font-bold mt-4">Page Not Found</h1>
      <p className="text-muted-foreground mt-2">The page you're looking for doesn't exist.</p>
      <Link href="/">
        <button className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition">
          Back to Dashboard
        </button>
      </Link>
    </div>
  );
}
