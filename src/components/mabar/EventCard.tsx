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
    <article className="group grid grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-lift">
      <div className="relative min-h-[250px] overflow-hidden bg-navy/5 sm:min-h-[290px]">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={"Poster " + event.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-navy to-navy-deep p-4 text-center text-on-dark">
            <div>
              <p className="eyebrow text-teal">Newton Badminton Club</p>
              <p className="mt-3 font-display text-xl font-extrabold leading-tight">Jadwal Mabar</p>
              <p className="mt-2 text-xs text-on-dark-muted">{formatEventDate(event.starts_at)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col p-3 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="eyebrow rounded-full bg-teal-soft px-2 py-0.5 !text-[10px] text-teal">{event.event_type}</span>
          <span className="eyebrow rounded-full bg-orange-soft px-2 py-0.5 !text-[10px] text-orange">{formatRp(event.price)}</span>
        </div>

        <div className="mt-2 flex items-start gap-2">
          <div className="grid h-12 w-11 shrink-0 place-items-center rounded-lg bg-navy text-center text-on-dark sm:h-[60px] sm:w-[54px]">
            <div>
              <p className="eyebrow !text-[8px] text-teal">{d.weekday}</p>
              <p className="font-display text-xl font-extrabold leading-none sm:text-2xl">{d.day}</p>
              <p className="text-[9px] font-semibold uppercase text-on-dark-muted">{d.month}</p>
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold leading-tight text-navy sm:text-lg">{event.title}</h3>
            <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{formatEventDate(event.starts_at)}</p>
          </div>
        </div>

        <div className="mt-3 space-y-2 text-xs sm:text-sm">
          <p className="flex items-start gap-2 text-foreground">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
            <span>{event.time_slots}</span>
          </p>
          <p className="flex items-start gap-2 text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange" />
            <a href={event.maps_url} target="_blank" rel="noreferrer" className="min-w-0 hover:text-navy hover:underline">
              <span className="font-semibold text-foreground">{event.venue}</span>
              <span className="hidden sm:inline"> — {event.address}</span>
            </a>
          </p>
        </div>

        <div className="mt-auto space-y-3 pt-3 sm:space-y-4 sm:pt-4">
          <QuotaBar filled={event.filled} quotaMax={event.quota_max} waitlist={event.waitlist} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button size="sm" variant="whatsapp" onClick={() => onRegister(event, "wa")}>
              <MessageCircle /> WhatsApp
            </Button>
            <Button size="sm" variant={q.isFull ? "teal" : "cta"} onClick={() => onRegister(event, "web")}>
              <MonitorSmartphone /> {q.isFull ? "Waiting List" : "Daftar"}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
