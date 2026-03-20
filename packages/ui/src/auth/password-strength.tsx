"use client";

interface PasswordStrengthProps {
  password: string;
}

interface Check {
  label: string;
  passed: boolean;
}

function getChecks(password: string): Check[] {
  return [
    { label: "8+ characters", passed: password.length >= 8 },
    { label: "Uppercase letter", passed: /[A-Z]/.test(password) },
    { label: "Number", passed: /\d/.test(password) },
    { label: "Special character", passed: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function isPasswordStrong(password: string): boolean {
  return getChecks(password).every((c) => c.passed);
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null;

  const checks = getChecks(password);
  const passedCount = checks.filter((c) => c.passed).length;
  const strength = passedCount / checks.length;

  const barColor =
    strength <= 0.25
      ? "bg-red-500"
      : strength <= 0.5
        ? "bg-orange-500"
        : strength <= 0.75
          ? "bg-yellow-500"
          : "bg-green-500";

  return (
    <div className="space-y-2">
      {/* Strength bar */}
      <div className="h-1.5 w-full rounded-full bg-[var(--theme-border)]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${strength * 100}%` }}
        />
      </div>
      {/* Check list */}
      <div className="grid grid-cols-2 gap-1">
        {checks.map((check) => (
          <span
            key={check.label}
            className={`text-[11px] ${check.passed ? "text-green-500" : "text-[var(--text-disabled)]"}`}
          >
            {check.passed ? "\u2713" : "\u2022"} {check.label}
          </span>
        ))}
      </div>
    </div>
  );
}
