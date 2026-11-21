import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, BellRing, CalendarCheck2, Handshake, MapPin, QrCode, ShieldCheck, Trophy } from "lucide-react";
import heroImg from "@/assets/hero-smash.webp";
import communityImg from "@/assets/community-mabar.webp";
import { Button } from "@/components/ui/button";
import { EventsGrid } from "@/components/mabar/EventsGrid";
import { QuotaBar } from "@/components/mabar/QuotaBar";
import { ProductGrid } from "@/components/store/ProductGrid";
import { eventsQuery, productsQuery } from "@/lib/queries";
import { BRAND, formatEventDate, formatRp } from "@/lib/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Newton Badminton Club Malang — Mabar Bulutangkis Tiap Minggu" },
      { name: "description", content: "Daftar mabar bulutangkis di Galaxy Badminton Arena Malang. Kuota real-time, bayar QRIS, Rp 20.000/sesi. Mabar No Pressure!" },
      { property: "og:title", content: "Newton Badminton Club Malang — Mabar No Pressure" },
      { property: "og:description", content: "Jadwal mabar, kuota real-time, dan daftar online komunitas bulutangkis Newton BC Malang." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(eventsQuery()),
      context.queryClient.ensureQueryData(productsQuery()),
    ]);
  },
  component: Index,
});

function Index() {
  const { data: events } = useSuspenseQuery(eventsQuery());
  const { data: products } = useSuspenseQuery(productsQuery());
  const featured = events.find((e) => e.is_featured) ?? events[0];

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-navy-deep text-on-dark">
        <img src={heroImg} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover object-[70%_center]" />
        <div className="hero-fade absolute inset-0 -z-10" aria-hidden />
        <div className="absolute inset-0 -z-10 bg-navy-deep/40 lg:bg-transparent" aria-hidden />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-12 pt-12 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:pb-20 lg:pt-24">
          <div className="animate-rise space-y-6">
            <p className="eyebrow inline-flex items-center gap-2 rounded-full border border-on-dark/20 bg-on-dark/10 px-3 py-1.5 text-on-dark backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-orange" /> Komunitas Bulutangkis • Kota Malang
            </p>
            <h1 className="display-title text-5xl sm:text-6xl lg:text-7xl">
              Mabar <span className="text-orange">No Pressure</span>,<br />
              Malang Semua <span className="text-teal">Teman</span>
            </h1>
            <p className="max-w-lg text-base text-on-dark-muted sm:text-lg">
              Dari pemula sampai kompetitif, semua dapat pasangan main yang seimbang. Cek kuota real-time, daftar, dan bayar dalam satu menit.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="cta" size="xl">
                <Link to="/jadwal">
                  Daftar Mabar Sekarang <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="onDark" size="xl">
                <a href={BRAND.venue.mapsUrl} target="_blank" rel="noreferrer">
                  <MapPin /> Galaxy Arena
                </a>
              </Button>
            </div>
            <dl className="grid max-w-lg grid-cols-3 gap-3 pt-2">
              {[
                { k: `${events.length}`, v: "Sesi terjadwal" },
                { k: "20rb", v: "HTM per sesi" },
                { k: "All", v: "Level welcome" },
              ].map((s, i) => (
                <div key={i} className="rounded-xl border border-on-dark/15 bg-on-dark/10 p-3 backdrop-blur">
                  <dt className="sr-only">{s.v}</dt>
                  <dd className="font-display text-2xl font-extrabold">{s.k}</dd>
                  <p className="text-[11px] font-medium text-on-dark-muted">{s.v}</p>
                </div>
              ))}
            </dl>
          </div>

          {featured && (
            <div className="animate-rise rounded-2xl border border-on-dark/15 bg-navy-deep/70 p-5 shadow-lift backdrop-blur-md" style={{ animationDelay: "120ms" }}>
              <p className="eyebrow text-orange">Sesi Terdekat</p>
              <p className="mt-1 font-display text-xl font-extrabold leading-tight">{featured.title}</p>
              <p className="mt-1 text-sm text-on-dark-muted">{formatEventDate(featured.starts_at)}</p>
              <p className="mt-0.5 text-sm text-on-dark-muted">{featured.time_slots}</p>
              <div className="mt-4">
                <QuotaBar filled={featured.filled} quotaMax={featured.quota_max} waitlist={featured.waitlist} onDark />
              </div>
              <Button asChild variant="cta" className="mt-4 w-full">
                <Link to="/jadwal">Amankan Slot • {formatRp(featured.price)}</Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Jadwal */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <p className="eyebrow text-teal">Pay-Per-Session</p>
            <h2 className="display-title mt-1 text-3xl text-navy sm:text-4xl">Jadwal Mabar</h2>
          </div>
          <Button asChild variant="ghost" className="shrink-0">
            <Link to="/jadwal">Semua <ArrowRight /></Link>
          </Button>
        </div>
        <EventsGrid events={events.slice(0, 3)} />
      </section>

      {/* How it works */}
      <section className="bg-card">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <p className="eyebrow text-teal">Cara Daftar</p>
          <h2 className="display-title mt-1 text-3xl text-navy sm:text-4xl">3 Langkah, Langsung Main</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { icon: CalendarCheck2, t: "Pilih jadwal", d: "Lihat kuota real-time tiap sesi. Kalau penuh, masuk waiting list otomatis." },
              { icon: QrCode, t: "Bayar QRIS / Transfer", d: "QRIS terkonfirmasi instan. Transfer manual cukup kirim bukti ke WA Admin." },
              { icon: BellRing, t: "Dapat E-Ticket", d: "Tiket & notifikasi status ada di Tiket Saya. Bisa ajukan cancel atau oper slot." },
            ].map((s, i) => (
              <li key={s.t} className="relative rounded-2xl border border-border bg-background p-6">
                <span className="display-title absolute right-5 top-4 text-5xl text-muted">{i + 1}</span>
                <s.icon className="h-7 w-7 text-orange" />
                <p className="mt-4 font-display text-lg font-extrabold text-navy">{s.t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Community */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-navy text-on-dark lg:grid-cols-2">
          <img src={communityImg} alt="Member Newton BC tertawa bersama di lapangan" loading="lazy" className="h-64 w-full object-cover lg:h-full" />
          <div className="space-y-5 p-6 sm:p-10">
            <p className="eyebrow text-teal">Est. {BRAND.est}</p>
            <h2 className="display-title text-3xl sm:text-4xl">Bukan Sekadar Main, Ini Rumah Kedua</h2>
            <ul className="space-y-3 text-sm text-on-dark-muted">
              <li className="flex gap-3"><Handshake className="h-5 w-5 shrink-0 text-orange" /> Matchmaking seimbang sesuai skill level.</li>
              <li className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-teal" /> Kuota real-time, kas & jadwal tertata transparan.</li>
              <li className="flex gap-3"><Trophy className="h-5 w-5 shrink-0 text-orange" /> Rutin mabar mingguan & Mini Cup bulanan.</li>
            </ul>
            <Button asChild variant="onDark">
              <Link to="/komunitas">Kenalan dengan Newton BC <ArrowRight /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Store */}
      <section className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
        <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <p className="eyebrow text-teal">Official Merch & Gear</p>
            <h2 className="display-title mt-1 text-3xl text-navy sm:text-4xl">Club Store</h2>
          </div>
          <Button asChild variant="ghost" className="shrink-0">
            <Link to="/store">Lihat <ArrowRight /></Link>
          </Button>
        </div>
        <ProductGrid products={products} />
      </section>
    </>
  );
}
