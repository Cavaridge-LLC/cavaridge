import { Link } from "wouter";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <h1 className="text-6xl font-bold text-muted-foreground mb-4">404</h1>
      <p className="text-lg text-muted-foreground mb-8">Page not found</p>
      <Link href="/" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
        Back to Forge
      </Link>
    </div>
  );
}
