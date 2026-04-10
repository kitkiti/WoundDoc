import { cn } from "@/lib/utils";

type StickyActionBarProps = {
  children: React.ReactNode;
  className?: string;
};

export function StickyActionBar({ children, className }: StickyActionBarProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 mt-6 border-t border-white/65 bg-white/92 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-16px_40px_rgba(14,34,48,0.08)] backdrop-blur md:mx-0 md:rounded-[28px] md:border md:px-5",
        className
      )}
    >
      {children}
    </div>
  );
}
