export function DuckyFooter() {
  return (
    <footer className="border-t border-border bg-background py-2 px-4 flex items-center justify-between text-[10px] text-muted-foreground">
      <span>CERES &copy; {new Date().getFullYear()} Cavaridge, LLC</span>
      <span className="flex items-center gap-1">
        Powered by Ducky Intelligence
      </span>
    </footer>
  );
}
