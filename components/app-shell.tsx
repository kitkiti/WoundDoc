import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { type CaseStep } from "@/lib/case-flow";
import { cn } from "@/lib/utils";
import { DisclaimerBanner } from "@/components/disclaimer-banner";
import { ProgressStepper } from "@/components/progress-stepper";

type AppShellProps = {
  title: string;
  subtitle: string;
  currentStep?: CaseStep;
  backHref?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function AppShell({
  title,
  subtitle,
  currentStep,
  backHref,
  badge,
  children,
  className
}: AppShellProps) {
  return (
    <main className="min-h-screen bg-mesh px-4 py-5 text-ink">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 pb-12">
        <div className="rounded-[32px] border border-white/75 bg-white/75 p-5 shadow-float backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal">WoundWatch</p>
              <h1 className="mt-2 font-display text-[2rem] leading-none text-ink">{title}</h1>
              <p className="mt-3 text-sm leading-6 text-ink/70">{subtitle}</p>
            </div>
            {badge}
          </div>

          {backHref ? (
            <Link
              href={backHref}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-tide px-3 py-2 text-sm font-medium text-ink transition hover:border-teal/30 hover:text-teal"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Link>
          ) : null}
        </div>

        <DisclaimerBanner />
        {currentStep ? <ProgressStepper currentStep={currentStep} /> : null}
        <div className={cn("flex flex-col gap-4", className)}>{children}</div>
      </div>
    </main>
  );
}
