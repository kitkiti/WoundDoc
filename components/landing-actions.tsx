"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Play, Plus } from "lucide-react";
import { demoCases } from "@/lib/demo/cases";

function createCaseId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `case-${Date.now()}`;
}

export function LandingActions() {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => router.push(`/cases/${createCaseId()}/upload`)}
        className="flex w-full items-center justify-center gap-3 rounded-[28px] bg-ink px-5 py-4 text-base font-semibold text-white shadow-float transition hover:bg-teal"
      >
        <Plus className="h-5 w-5" />
        Start new encounter
      </button>

      <div className="space-y-3">
        {demoCases.map((demoCase) => (
          <button
            key={demoCase.id}
            type="button"
            onClick={() => router.push(`/cases/${createCaseId()}/analysis?demo=${demoCase.id}`)}
            className="flex w-full items-center gap-4 rounded-[28px] border border-white/70 bg-white/85 p-3 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-float"
          >
            <Image
              src={`/demo/${demoCase.imageFileName}`}
              alt={demoCase.title}
              width={80}
              height={80}
              className="h-20 w-20 rounded-[22px] object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
                {demoCase.badge}
              </p>
              <p className="mt-1 text-base font-semibold text-ink">{demoCase.title}</p>
              <p className="mt-1 text-sm text-ink/65">{demoCase.subtitle}</p>
            </div>
            <Play className="h-5 w-5 text-coral" />
          </button>
        ))}
      </div>
    </div>
  );
}
