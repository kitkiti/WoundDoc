import { ArrowRight, ShieldCheck, Stethoscope, FileText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LandingActions } from "@/components/landing-actions";

export default function HomePage() {
  return (
    <AppShell
      title="Longitudinal wound monitoring"
      subtitle="Capture a wound encounter, review transparent AI estimates, add clinician-entered measurements, and export structured longitudinal documentation."
      badge={
        <div className="rounded-full bg-teal px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
          Demo-ready
        </div>
      }
    >
      <div className="rounded-[32px] border border-white/70 bg-white/85 p-5 shadow-float">
        <div className="rounded-[28px] bg-gradient-to-br from-ink via-teal to-aqua p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
            Wound monitoring workflow
          </p>
          <h2 className="mt-3 font-display text-3xl leading-none">
            Track wound encounters with source-aware clinical review
          </h2>
          <p className="mt-4 text-sm leading-6 text-white/85">
            WoundWatch is a browser-based demo, not a diagnostic device. It stores wound
            encounters on a longitudinal timeline, separates AI-estimated versus clinician-entered
            values, and prepares a reviewable note.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-medium">
            Explore full flow
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {[
          {
            icon: Stethoscope,
            title: "For clinician review",
            body: "AI estimates stay visibly separate from manual wound assessment and never claim autonomous diagnosis."
          },
          {
            icon: ShieldCheck,
            title: "Timeline-ready",
            body: "Patient, wound, and encounter records are stored separately so the wound can accumulate repeat assessments."
          },
          {
            icon: FileText,
            title: "Structured export",
            body: "JSON includes wound metrics, clinician overrides, and encounter context before copy or download."
          }
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-[28px] border border-white/70 bg-white/82 p-4 shadow-card"
          >
            <item.icon className="h-5 w-5 text-teal" />
            <p className="mt-3 text-base font-semibold text-ink">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-ink/65">{item.body}</p>
          </div>
        ))}
      </div>

      <LandingActions />
    </AppShell>
  );
}
