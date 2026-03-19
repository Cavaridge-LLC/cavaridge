export function DuckyFooter() {
  return (
    <footer className="flex items-center justify-center px-6 py-3 border-t border-border bg-card/50 text-xs text-muted-foreground gap-2">
      <span>&copy; {new Date().getFullYear()} Cavaridge, LLC. All rights reserved.</span>
      <span className="text-border">|</span>
      <span>Powered by Ducky Intelligence</span>
    </footer>
  );
}
