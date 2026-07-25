import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#ebbf5d] via-[#f0cb7c] to-[#cf4427] text-[#041a6c] shadow-[0_8px_24px_rgba(235,191,93,.24)]">
        <span className="text-sm font-black tracking-[-0.08em]">C</span>
        <span className="absolute -right-1 -top-1 size-3 rounded-full bg-[#cf4427] ring-2 ring-[#041a6c]" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold tracking-[-0.025em] text-[var(--foreground)]">
            Catalyst
          </p>
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            Procurement OS
          </p>
        </div>
      )}
    </div>
  );
}
