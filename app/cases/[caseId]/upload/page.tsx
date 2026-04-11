"use client";
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StickyActionBar } from "@/components/sticky-action-bar";
import { getCaseDraft, saveCaseDraft } from "@/lib/client/case-draft";
import type { CaptureContext, UploadRecord } from "@/lib/types/schema";
import { cn } from "@/lib/utils";

type UploadPageProps = {
  params: {
    caseId: string;
  };
};

const referenceTypeOptions: Array<{
  label: string;
  value: Exclude<CaptureContext["reference_type"], "none">;
}> = [
  { label: "Ruler", value: "ruler" },
  { label: "Round marker", value: "marker" },
  { label: "Color card", value: "color_card" },
  { label: "Other ref", value: "other" }
];

function createEmptyCaptureContext(): CaptureContext {
  return {
    reference_visible: false,
    reference_type: "none",
    reference_length_cm: null,
    reference_length_px: null,
    pixels_per_cm: null,
    calibration_status: "not_calibrated",
    notes: ""
  };
}

function parseOptionalNumber(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringifyNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function deriveCaptureContext(current: CaptureContext): CaptureContext {
  const pixelsPerCm =
    current.reference_visible &&
    current.reference_length_cm &&
    current.reference_length_cm > 0 &&
    current.reference_length_px &&
    current.reference_length_px > 0
      ? current.reference_length_px / current.reference_length_cm
      : null;

  return {
    ...current,
    reference_type: current.reference_visible ? current.reference_type : "none",
    reference_length_cm: current.reference_visible ? current.reference_length_cm : null,
    reference_length_px: current.reference_visible ? current.reference_length_px : null,
    pixels_per_cm: pixelsPerCm,
    calibration_status: pixelsPerCm ? "manual_override" : "not_calibrated"
  };
}

export default function UploadPage({ params }: UploadPageProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadRecord, setUploadRecord] = useState<UploadRecord | null>(null);
  const [captureContext, setCaptureContext] = useState<CaptureContext>(createEmptyCaptureContext());
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const draft = getCaseDraft(params.caseId);
    if (draft?.upload) {
      setUploadRecord(draft.upload);
    }
    if (draft?.captureContext) {
      setCaptureContext(draft.captureContext);
    }
  }, [params.caseId]);

  const previewUrl = useMemo(() => {
    if (selectedFile) {
      return URL.createObjectURL(selectedFile);
    }

    return uploadRecord?.image_url ?? "";
  }, [selectedFile, uploadRecord?.image_url]);

  const normalizedCaptureContext = useMemo(
    () => deriveCaptureContext(captureContext),
    [captureContext]
  );

  useEffect(() => {
    return () => {
      if (selectedFile && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, selectedFile]);

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setSelectedFile(file);
    setError("");
  };

  const updateCaptureContext = <K extends keyof CaptureContext>(
    field: K,
    value: CaptureContext[K]
  ) => {
    setCaptureContext((current) => ({
      ...current,
      [field]: value
    }));
  };

  const persistDraftAndContinue = () => {
    saveCaseDraft(params.caseId, {
      upload: uploadRecord ?? undefined,
      captureContext: normalizedCaptureContext
    });
    router.push(`/cases/${params.caseId}/risk`);
  };

  const handleContinue = async () => {
    if (!selectedFile && uploadRecord) {
      persistDraftAndContinue();
      return;
    }

    if (!selectedFile) {
      setError("Choose or capture an image to continue.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("caseId", params.caseId);
      formData.append("file", selectedFile);
      formData.append("referenceVisible", String(normalizedCaptureContext.reference_visible));
      formData.append("referenceType", normalizedCaptureContext.reference_type);
      formData.append(
        "referenceLengthCm",
        normalizedCaptureContext.reference_length_cm === null
          ? ""
          : String(normalizedCaptureContext.reference_length_cm)
      );
      formData.append(
        "referenceLengthPx",
        normalizedCaptureContext.reference_length_px === null
          ? ""
          : String(normalizedCaptureContext.reference_length_px)
      );
      formData.append("referenceNotes", normalizedCaptureContext.notes);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Upload failed.");
      }

      setUploadRecord(payload.upload);
      saveCaseDraft(params.caseId, {
        upload: payload.upload,
        captureContext: payload.capture_context ?? normalizedCaptureContext
      });
      router.push(`/cases/${params.caseId}/risk`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Capture or upload"
      subtitle="Use a bedside photo or sample camera flow. Add a visible reference when you want the app to normalize mask measurements into centimeters."
      currentStep="upload"
      backHref="/"
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-[32px] border border-dashed border-teal/35 bg-white/82 p-5 text-left shadow-card transition hover:border-teal/60"
      >
        <div className="rounded-[28px] bg-gradient-to-br from-teal/15 via-white to-coral/10 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal">
                Mobile capture
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Photo input</h2>
              <p className="mt-3 max-w-[20rem] text-sm leading-6 text-ink/65">
                Tap once to browse images or open the phone camera on supported devices.
              </p>
            </div>
            <div className="rounded-[26px] bg-white p-4 shadow-card">
              <Camera className="h-8 w-8 text-teal" />
            </div>
          </div>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white">
            <ImagePlus className="h-4 w-4" />
            Select image
          </div>
        </div>
      </button>

      <input
        ref={inputRef}
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelection}
      />

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
              Preview
            </p>
            <p className="mt-1 text-sm text-ink/65">
              Image stays local to this demo workspace and can be replaced at any time.
            </p>
          </div>
          <Sparkles className="h-5 w-5 text-coral" />
        </div>

        <div className="mt-4 overflow-hidden rounded-[26px] bg-mist">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Selected wound preview"
              className="h-[320px] w-full object-cover"
            />
          ) : (
            <div className="flex h-[320px] items-center justify-center px-6 text-center text-sm text-ink/45">
              No image selected yet. Capture a bedside photo or upload an existing sample.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          Calibrated capture
        </p>
        <p className="mt-2 text-sm leading-6 text-ink/65">
          Include a ruler, marker, or color card in the photo, then enter its known size and
          visible pixel span. WoundWatch uses that reference to convert mask-derived measurements
          from pixels into centimeters.
        </p>

        <div className="mt-4 flex gap-2">
          {[
            { label: "No reference", value: false },
            { label: "Reference visible", value: true }
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() =>
                updateCaptureContext(
                  "reference_visible",
                  option.value as CaptureContext["reference_visible"]
                )
              }
              className={cn(
                "flex-1 rounded-full px-4 py-3 text-sm font-semibold transition",
                normalizedCaptureContext.reference_visible === option.value
                  ? "bg-ink text-white"
                  : "border border-ink/10 bg-mist text-ink/65"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {normalizedCaptureContext.reference_visible ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {referenceTypeOptions.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    updateCaptureContext(
                      "reference_type",
                      value as CaptureContext["reference_type"]
                    )
                  }
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    normalizedCaptureContext.reference_type === value
                      ? "bg-teal text-white"
                      : "border border-ink/10 bg-mist text-ink/65"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="rounded-[22px] bg-mist p-4">
                <span className="text-sm font-semibold text-ink">Known reference size (cm)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  value={stringifyNumber(normalizedCaptureContext.reference_length_cm)}
                  onChange={(event) =>
                    updateCaptureContext(
                      "reference_length_cm",
                      parseOptionalNumber(event.target.value)
                    )
                  }
                  className="mt-3 w-full rounded-[18px] border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-teal"
                />
              </label>

              <label className="rounded-[22px] bg-mist p-4">
                <span className="text-sm font-semibold text-ink">Visible reference span (px)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min={0}
                  value={stringifyNumber(normalizedCaptureContext.reference_length_px)}
                  onChange={(event) =>
                    updateCaptureContext(
                      "reference_length_px",
                      parseOptionalNumber(event.target.value)
                    )
                  }
                  className="mt-3 w-full rounded-[18px] border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-teal"
                />
              </label>
            </div>

            <label className="mt-3 block rounded-[22px] bg-mist p-4">
              <span className="text-sm font-semibold text-ink">Reference notes</span>
              <textarea
                rows={2}
                value={normalizedCaptureContext.notes}
                onChange={(event) => updateCaptureContext("notes", event.target.value.slice(0, 240))}
                placeholder="Optional note about where the reference sits in the frame"
                className="mt-3 w-full rounded-[18px] border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-teal"
              />
            </label>
          </>
        ) : null}

        <div className="mt-4 rounded-[22px] bg-mist px-4 py-3 text-sm text-ink/70">
          Calibration status:{" "}
          {normalizedCaptureContext.calibration_status === "manual_override"
            ? `ready at ${normalizedCaptureContext.pixels_per_cm?.toFixed(2)} px/cm`
            : "not calibrated yet"}
        </div>
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
          disabled={isSubmitting}
          className="w-full rounded-[24px] bg-ink px-5 py-4 text-base font-semibold text-white shadow-float transition hover:bg-teal disabled:cursor-not-allowed disabled:bg-ink/45"
        >
          {isSubmitting ? "Uploading image..." : "Continue to wound context"}
        </button>
      </StickyActionBar>
    </AppShell>
  );
}
