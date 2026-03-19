interface ScoreGaugeProps {
  score: number;
  maxScore?: number;
  label: string;
  size?: "sm" | "lg";
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-amber-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

function strokeColor(score: number): string {
  if (score >= 80) return "stroke-green-500";
  if (score >= 60) return "stroke-amber-500";
  if (score >= 40) return "stroke-orange-500";
  return "stroke-red-500";
}

export function ScoreGauge({ score, maxScore = 100, label, size = "lg" }: ScoreGaugeProps) {
  const pct = maxScore > 0 ? Math.min(score / maxScore, 1) : 0;
  const r = size === "lg" ? 54 : 36;
  const stroke = size === "lg" ? 8 : 6;
  const circumference = 2 * Math.PI * r;
  const dashoffset = circumference * (1 - pct);
  const svgSize = (r + stroke) * 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={svgSize} height={svgSize} className="-rotate-90">
        <circle cx={r + stroke} cy={r + stroke} r={r} fill="none" className="stroke-muted" strokeWidth={stroke} />
        <circle
          cx={r + stroke}
          cy={r + stroke}
          r={r}
          fill="none"
          className={strokeColor(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: svgSize, height: svgSize }}>
        <span className={`font-bold ${size === "lg" ? "text-3xl" : "text-xl"} ${scoreColor(score)}`}>{score}</span>
        <span className="text-xs text-muted-foreground">/ {maxScore}</span>
      </div>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">{label}</span>
    </div>
  );
}
