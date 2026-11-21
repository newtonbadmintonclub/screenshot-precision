import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MapPin, MessageCircle } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { EventsGrid } from "@/components/mabar/EventsGrid";
import { Button } from "@/components/ui/button";
import { eventsQuery } from "@/lib/queries";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/jadwal")({
  head: () => ({
    meta: [
      { title: "Jadwal Mabar Bulutangkis Malang — Newton BC" },
      { name: "description", content: "Jadwal mabar Newton Badminton Club di Galaxy Badminton Arena Malang. Kuota real-time, daftar via WhatsApp atau website." },
      { property: "og:title", content: "Jadwal Mabar — Newton Badminton Club Malang" },
      { property: "og:description", content: "Cek kuota real-time dan amankan slot mabar kamu. Rp 20.000/sesi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(eventsQuery());
  },
  component: JadwalPage,
});

function JadwalPage() {
  const { data: events } = useSuspenseQuery({ ...eventsQuery(), refetchInterval: 30_000 });
  return (
    <>
      <PageHero eyebrow="Pay-Per-Session" title="Jadwal Mabar">
        Pilih sesi, cek kuota real-time, lalu daftar via WhatsApp atau website. Kuota penuh? Masuk waiting list otomatis.
      </PageHero>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <EventsGrid events={events} />
        <div className="mt-10 grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-orange" />
            <div className="min-w-0">
              <p className="font-bold text-navy">{BRAND.venue.name}</p>
              <p className="text-sm text-muted-foreground">{BRAND.venue.address}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><a href={BRAND.venue.mapsUrl} target="_blank" rel="noreferrer"><MapPin /> Buka Maps</a></Button>
            <Button asChild variant="whatsapp"><a href={BRAND.waShortLink} target="_blank" rel="noreferrer"><MessageCircle /> Tanya Admin</a></Button>
          </div>
        </div>
      </section>
    </>
  );
}
