"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { StickyActionBar } from "@/components/sticky-action-bar";
import { demoCases } from "@/lib/demo/cases";
import { getCaseDraft, saveCaseDraft } from "@/lib/client/case-draft";
import type { RiskForm } from "@/lib/types/schema";
import { cn } from "@/lib/utils";

const bodySiteOptions = [
  "Sacrum",
  "Right heel",
  "Left heel",
  "Left ear",
  "Trochanter",
  "Elbow"
];

const emptyForm: RiskForm = {
  body_site: "",
  mobility_limited: false,
  moisture_issue: false,
  nutrition_risk: false,
  device_present: false,
  previous_pressure_injury: false,
  support_surface_in_use: false,
  formal_risk_score: null,
  clinician_severity_score: null,
  clinician_confirmation_status: "pending",
  clinician_confirmation_note: "",
  comments: ""
};

type RiskPageProps = {
  params: {
    caseId: string;
  };
};

export default function RiskPage({ params }: RiskPageProps) {
  const router = useRouter();
  const [form, setForm] = useState<RiskForm>(emptyForm);
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const draft = getCaseDraft(params.caseId);

    if (!draft?.upload) {
      router.replace(`/cases/${params.caseId}/upload`);
      return;
    }

    setImageUrl(draft.upload.image_url);
    setForm(draft.riskForm ?? emptyForm);
  }, [params.caseId, router]);

  const selectedPreset = useMemo(
    () => demoCases.find((demoCase) => demoCase.riskForm.body_site === form.body_site)?.id,
    [form.body_site]
  );

  const updateField = <K extends keyof RiskForm>(field: K, value: RiskForm[K]) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleContinue = () => {
    if (!form.body_site.trim()) {
      setError("Add a body site before continuing.");
      return;
    }

    saveCaseDraft(params.caseId, {
      riskForm: form
    });
    router.push(`/cases/${params.caseId}/analysis`);
  };

  return (
    <AppShell
      title="Wound context"
      subtitle="Add structured bedside context so the wound timeline, checklist, and note draft do not rely on image output alone."
      currentStep="risk"
      backHref={`/cases/${params.caseId}/upload`}
    >
      <div className="rounded-[30px] border border-white/70 bg-white/82 p-4 shadow-card">
        <div className="flex items-start gap-4">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt="Uploaded wound"
              width={96}
              height={96}
              unoptimized
              className="h-24 w-24 rounded-[24px] object-cover"
            />
          ) : (
            <div className="h-24 w-24 rounded-[24px] bg-mist" />
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
              Active encounter
            </p>
            <p className="mt-2 text-lg font-semibold text-ink">Short bedside risk form</p>
            <p className="mt-1 text-sm leading-6 text-ink/65">
              Sample presets are included for demo speed, but all fields remain editable.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          Presets
        </p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {demoCases.map((demoCase) => (
            <button
              key={demoCase.id}
              type="button"
              onClick={() => setForm(demoCase.riskForm)}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition",
                selectedPreset === demoCase.id
                  ? "bg-teal text-white"
                  : "border border-ink/10 bg-mist text-ink/65"
              )}
            >
              {demoCase.title}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <label className="text-sm font-semibold text-ink">Body site</label>
        <div className="mt-3 flex flex-wrap gap-2">
          {bodySiteOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => updateField("body_site", option)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                form.body_site === option
                  ? "bg-ink text-white"
                  : "border border-ink/10 bg-mist text-ink/65"
              )}
            >
              {option}
            </button>
          ))}
        </div>
        <input
          value={form.body_site}
          onChange={(event) => updateField("body_site", event.target.value)}
          placeholder="Enter custom body site"
          className="mt-4 w-full rounded-[22px] border border-ink/10 bg-mist px-4 py-3 text-sm text-ink outline-none transition focus:border-teal"
        />
      </div>

      <SegmentedToggle
        label="Mobility limitation"
        description="Is the patient unable to reposition independently or at expected frequency?"
        value={form.mobility_limited}
        onChange={(value) => updateField("mobility_limited", value)}
      />
      <SegmentedToggle
        label="Moisture or incontinence issue"
        description="Include perspiration, drainage, or incontinence exposure."
        value={form.moisture_issue}
        onChange={(value) => updateField("moisture_issue", value)}
      />
      <SegmentedToggle
        label="Nutrition risk"
        description="Poor intake, weight loss, or concern for delayed tissue recovery."
        value={form.nutrition_risk}
        onChange={(value) => updateField("nutrition_risk", value)}
      />
      <SegmentedToggle
        label="Device present"
        description="Tubing, braces, dressings, or equipment may contribute to localized pressure."
        value={form.device_present}
        onChange={(value) => updateField("device_present", value)}
      />
      <SegmentedToggle
        label="Previous pressure injury"
        description="History of prior pressure injury or recurrent skin breakdown."
        value={form.previous_pressure_injury}
        onChange={(value) => updateField("previous_pressure_injury", value)}
      />
      <SegmentedToggle
        label="Support surface in use"
        description="Confirm whether preventive support surfaces or offloading tools are already in place."
        value={form.support_surface_in_use}
        onChange={(value) => updateField("support_surface_in_use", value)}
      />

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <label className="text-sm font-semibold text-ink">Formal risk score</label>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={40}
          value={form.formal_risk_score ?? ""}
          onChange={(event) =>
            updateField(
              "formal_risk_score",
              event.target.value === "" ? null : Number(event.target.value)
            )
          }
          placeholder="Optional"
          className="mt-3 w-full rounded-[22px] border border-ink/10 bg-mist px-4 py-3 text-sm text-ink outline-none transition focus:border-teal"
        />

        <label className="mt-4 block text-sm font-semibold text-ink">
          Clinician severity score (0-10)
        </label>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={10}
          value={form.clinician_severity_score ?? ""}
          onChange={(event) =>
            updateField(
              "clinician_severity_score",
              event.target.value === "" ? null : Number(event.target.value)
            )
          }
          placeholder="Optional"
          className="mt-3 w-full rounded-[22px] border border-ink/10 bg-mist px-4 py-3 text-sm text-ink outline-none transition focus:border-teal"
        />

        <label className="mt-4 block text-sm font-semibold text-ink">
          Clinician confirmation status
        </label>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {([
            { label: "Pending", value: "pending" },
            { label: "Confirmed", value: "confirmed" },
            { label: "Needs review", value: "needs_review" }
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateField("clinician_confirmation_status", option.value)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                form.clinician_confirmation_status === option.value
                  ? "bg-ink text-white"
                  : "border border-ink/10 bg-mist text-ink/65"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-semibold text-ink">
          Confirmation note
        </label>
        <textarea
          rows={3}
          value={form.clinician_confirmation_note}
          onChange={(event) => updateField("clinician_confirmation_note", event.target.value)}
          placeholder="Optional rationale for confirmation status"
          className="mt-3 w-full rounded-[22px] border border-ink/10 bg-mist px-4 py-3 text-sm text-ink outline-none transition focus:border-teal"
        />

        <label className="mt-4 block text-sm font-semibold text-ink">Comments</label>
        <textarea
          rows={4}
          value={form.comments}
          onChange={(event) => updateField("comments", event.target.value)}
          placeholder="Optional bedside context"
          className="mt-3 w-full rounded-[22px] border border-ink/10 bg-mist px-4 py-3 text-sm text-ink outline-none transition focus:border-teal"
        />
      </div>

      {error ? (
        <div className="rounded-[22px] border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
          {error}
        </div>
      ) : null}

      <StickyActionBar>
        <button
          type="button"
          onClick={handleContinue}
          className="w-full rounded-[24px] bg-ink px-5 py-4 text-base font-semibold text-white shadow-float transition hover:bg-teal"
        >
          Continue to encounter analysis
        </button>
      </StickyActionBar>
    </AppShell>
  );
}
