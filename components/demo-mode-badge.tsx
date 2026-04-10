import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

type DemoModeBadgeProps = {
  className?: string;
};

export function DemoModeBadge({ className }: DemoModeBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-teal/20 bg-white/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-teal shadow-card backdrop-blur",
        className
      )}
    >
      <FlaskConical className="h-3.5 w-3.5" />
      Demo mode
    </div>
  );
}
