"use client";

import { cn } from "@/lib/utils";

type SegmentedToggleProps = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description?: string;
};

export function SegmentedToggle({
  label,
  value,
  onChange,
  description
}: SegmentedToggleProps) {
  return (
    <div className="rounded-[28px] border border-white/70 bg-white/85 p-4 shadow-card">
      <div className="mb-3">
        <p className="text-sm font-semibold text-ink">{label}</p>
        {description ? <p className="mt-1 text-sm text-ink/60">{description}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            "rounded-[22px] px-4 py-3 text-sm font-semibold transition",
            value
              ? "bg-teal text-white shadow-card"
              : "border border-ink/10 bg-mist text-ink/65"
          )}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            "rounded-[22px] px-4 py-3 text-sm font-semibold transition",
            !value
              ? "bg-ink text-white shadow-card"
              : "border border-ink/10 bg-mist text-ink/65"
          )}
        >
          No
        </button>
      </div>
    </div>
  );
}
