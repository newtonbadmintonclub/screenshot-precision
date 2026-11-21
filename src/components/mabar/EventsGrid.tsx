import { useState } from "react";
import { CalendarX2 } from "lucide-react";
import { EventCard } from "./EventCard";
import { RegisterDialog } from "./RegisterDialog";
import type { PublicEvent } from "@/lib/public.functions";

export function EventsGrid({ events }: { events: PublicEvent[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"web" | "wa">("web");
  const [open, setOpen] = useState(false);
  const selected = events.find((e) => e.id === selectedId) ?? null;

  if (events.length === 0) {
    return (
      <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <CalendarX2 className="h-8 w-8 text-muted-foreground" />
        <p className="font-bold text-navy">Belum ada jadwal mabar terbaru</p>
        <p className="text-sm text-muted-foreground">Pantau Instagram @newtonclub09 untuk jadwal berikutnya.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {events.map((e, i) => (
          <div key={e.id} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
            <EventCard
              event={e}
              onRegister={(ev, t) => {
                setSelectedId(ev.id);
                setTab(t);
                setOpen(true);
              }}
            />
          </div>
        ))}
      </div>
      <RegisterDialog event={selected} initialTab={tab} open={open} onOpenChange={setOpen} />
    </>
  );
}
