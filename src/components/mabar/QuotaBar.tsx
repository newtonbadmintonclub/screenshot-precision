import { cn } from "@/lib/utils";
import { quotaState } from "@/lib/booking-status";

export function QuotaBar({ filled, quotaMax, waitlist = 0, onDark = false }: { filled: number; quotaMax: number; waitlist?: number; onDark?: boolean }) {
  const q = quotaState(filled, quotaMax);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs font-semibold">
        <span className={onDark ? "text-on-dark-muted" : "text-muted-foreground"}>
          Kuota <span className={cn("font-display text-sm font-extrabold", onDark ? "text-on-dark" : "text-navy")}>{filled}/{quotaMax}</span> Player
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px]",
            q.isFull ? "bg-destructive/10 text-destructive" : q.almostFull ? "bg-orange-soft text-orange" : "bg-teal-soft text-teal",
          )}
        >
          {q.isFull ? `Penuh${waitlist ? ` • ${waitlist} antre` : ""}` : `Sisa ${q.remaining} slot`}
        </span>
      </div>
      <div
        className={cn("h-2.5 overflow-hidden rounded-full", onDark ? "bg-on-dark/15" : "bg-muted")}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={quotaMax}
        aria-valuenow={filled}
        aria-label="Kuota terisi"
      >
        <div
          className={cn("h-full rounded-full transition-all duration-700", q.isFull ? "bg-destructive" : q.almostFull ? "bg-orange" : "bg-teal")}
          style={{ width: `${q.pct}%` }}
        />
      </div>
    </div>
  );
}
