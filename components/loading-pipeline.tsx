import { cn } from "@/lib/utils";

type LoadingPipelineProps = {
  completedSteps: number;
  stages: string[];
};

export function LoadingPipeline({ completedSteps, stages }: LoadingPipelineProps) {
  return (
    <div className="rounded-[32px] border border-white/70 bg-white/82 p-5 shadow-float backdrop-blur">
      <div className="rounded-[28px] bg-gradient-to-br from-teal/10 via-white to-coral/10 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal">Pipeline</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Processing wound encounter</h2>
          </div>
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-card">
            <div className="absolute inset-2 animate-pulse-soft rounded-full border-2 border-teal/25" />
            <div className="h-7 w-7 rounded-full bg-teal" />
          </div>
        </div>

        <div className="space-y-3">
          {stages.map((stage, index) => {
            const isComplete = index < completedSteps;
            const isActive = index === completedSteps;

            return (
              <div
                key={stage}
                className={cn(
                  "flex items-center gap-3 rounded-[22px] px-4 py-3 transition",
                  isComplete && "bg-sage/12",
                  isActive && "bg-teal/10",
                  !isComplete && !isActive && "bg-white/70"
                )}
              >
                <div
                  className={cn(
                    "h-3.5 w-3.5 rounded-full",
                    isComplete && "bg-sage",
                    isActive && "animate-pulse-soft bg-teal",
                    !isComplete && !isActive && "bg-ink/18"
                  )}
                />
                <p className="text-sm font-medium text-ink/80">{stage}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
