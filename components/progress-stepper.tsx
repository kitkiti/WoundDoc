import { caseSteps, type CaseStep, getStepIndex } from "@/lib/case-flow";
import { cn } from "@/lib/utils";

type ProgressStepperProps = {
  currentStep: CaseStep;
};

export function ProgressStepper({ currentStep }: ProgressStepperProps) {
  const activeIndex = getStepIndex(currentStep);

  return (
    <div className="rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-card backdrop-blur">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {caseSteps.map((step, index) => {
          const isActive = index === activeIndex;
          const isComplete = index < activeIndex;

          return (
            <div key={step.key} className="min-w-[72px] flex-1">
              <div className="mb-2 flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition",
                    isActive && "bg-ink text-white shadow-float",
                    isComplete && "bg-teal text-white",
                    !isActive && !isComplete && "bg-tide text-ink/55"
                  )}
                >
                  {index + 1}
                </div>
                {index < caseSteps.length - 1 ? (
                  <div
                    className={cn(
                      "h-1 flex-1 rounded-full",
                      index < activeIndex ? "bg-teal" : "bg-tide"
                    )}
                  />
                ) : null}
              </div>
              <p
                className={cn(
                  "text-xs font-semibold uppercase tracking-[0.18em]",
                  isActive || isComplete ? "text-ink" : "text-ink/45"
                )}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
