import { useTheme } from "@/hooks/use-theme";
import { Sun, Moon, Monitor } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
    { value: "system" as const, icon: Monitor, label: "System" },
  ];

  return (
    <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`p-1.5 rounded-md transition-colors ${
            theme === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title={label}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
