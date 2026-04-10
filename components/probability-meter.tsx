import { cn, toPercent } from "@/lib/utils";

type ProbabilityMeterProps = {
  label: string;
  value: number;
  accent?: "teal" | "coral" | "gold";
};

export function ProbabilityMeter({
  label,
  value,
  accent = "teal"
}: ProbabilityMeterProps) {
  return (
    <div className="rounded-[24px] border border-white/70 bg-white/85 p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-ink/70">{label}</span>
        <span className="text-sm font-semibold text-ink">{toPercent(value)}</span>
      </div>
      <div className="h-3 rounded-full bg-tide">
        <div
          className={cn(
            "h-3 rounded-full transition-all",
            accent === "teal" && "bg-teal",
            accent === "coral" && "bg-coral",
            accent === "gold" && "bg-gold"
          )}
          style={{ width: toPercent(value) }}
        />
      </div>
    </div>
  );
}
