import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">404 — Page Not Found</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Ducky couldn't find what you're looking for.
        </p>
      </div>
    </div>
  );
}
