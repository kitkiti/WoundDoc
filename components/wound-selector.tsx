"use client";

import type { WoundRecord } from "@/lib/types/schema";
import { cn } from "@/lib/utils";

type WoundSelectorProps = {
  wounds: WoundRecord[];
  selectedWoundId: string;
  onSelect: (woundId: string) => void;
};

export function WoundSelector({ wounds, selectedWoundId, onSelect }: WoundSelectorProps) {
  if (wounds.length === 0) {
    return (
      <div className="rounded-[22px] bg-mist px-4 py-3 text-sm text-ink/65">
        No wounds yet for this patient. Create one to enable baseline or follow-up encounters.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {wounds.map((wound) => (
        <button
          key={wound.wound_id}
          type="button"
          onClick={() => onSelect(wound.wound_id)}
          className={cn(
            "rounded-[24px] border p-4 text-left transition",
            selectedWoundId === wound.wound_id
              ? "border-teal bg-teal/8 shadow-card"
              : "border-white/70 bg-white/70 shadow-card"
          )}
        >
          <p className="text-sm font-semibold text-ink">{wound.label}</p>
          <p className="mt-1 text-sm text-ink/65">
            {wound.body_site?.trim() || "Body site not set"}
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-teal">
            {wound.encounter_ids.length} encounter{wound.encounter_ids.length === 1 ? "" : "s"}
          </p>
        </button>
      ))}
    </div>
  );
}
