import { Clock, MapPin, MessageCircle, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuotaBar } from "./QuotaBar";
import { formatDayParts, formatEventDate, formatRp } from "@/lib/brand";
import type { PublicEvent } from "@/lib/public.functions";
import { quotaState } from "@/lib/booking-status";

export function EventCard({ event, onRegister }: { event: PublicEvent; onRegister: (e: PublicEvent, tab: "web" | "wa") => void }) {
  const d = formatDayParts(event.starts_at);
  const q = quotaState(event.filled, event.quota_max);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-lift">
      <div className="flex gap-4 p-5">
        <div className="grid h-[72px] w-16 shrink-0 place-items-center rounded-xl bg-navy text-center text-on-dark">
          <div>
            <p className="eyebrow !text-[9px] text-teal">{d.weekday}</p>
            <p className="font-display text-2xl font-extrabold leading-none">{d.day}</p>
            <p className="text-[11px] font-semibold uppercase text-on-dark-muted">{d.month}</p>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="eyebrow rounded-full bg-teal-soft px-2 py-0.5 !text-[10px] text-teal">{event.event_type}</span>
            <span className="eyebrow rounded-full bg-orange-soft px-2 py-0.5 !text-[10px] text-orange">{formatRp(event.price)}</span>
          </div>
          <h3 className="text-lg font-extrabold leading-tight text-navy">{event.title}</h3>
          <p className="text-xs text-muted-foreground">{formatEventDate(event.starts_at)}</p>
        </div>
      </div>
      <div className="space-y-2 border-t border-dashed border-border px-5 py-4 text-sm">
        <p className="flex items-start gap-2 text-foreground">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
          <span>{event.time_slots}</span>
        </p>
        <p className="flex items-start gap-2 text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange" />
          <a href={event.maps_url} target="_blank" rel="noreferrer" className="hover:text-navy hover:underline">
            <span className="font-semibold text-foreground">{event.venue}</span> — {event.address}
          </a>
        </p>
      </div>
      <div className="mt-auto space-y-4 px-5 pb-5">
        <QuotaBar filled={event.filled} quotaMax={event.quota_max} waitlist={event.waitlist} />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="whatsapp" onClick={() => onRegister(event, "wa")}>
            <MessageCircle /> via WhatsApp
          </Button>
          <Button variant={q.isFull ? "teal" : "cta"} onClick={() => onRegister(event, "web")}>
            <MonitorSmartphone /> {q.isFull ? "Waiting List" : "via Website"}
          </Button>
        </div>
      </div>
    </article>
  );
}
