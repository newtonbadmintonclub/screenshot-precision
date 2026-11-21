import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Handshake, MapPin, MessageCircle, ShieldCheck, Trophy } from "lucide-react";
import communityImg from "@/assets/community-mabar.webp";
import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/button";
import { logoUrl } from "@/components/site/Logo";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/komunitas")({
  head: () => ({
    meta: [
      { title: "Tentang Komunitas — Newton Badminton Club Malang" },
      { name: "description", content: "Kenalan dengan Newton Badminton Club Malang: komunitas bulutangkis yang seru, suportif, dan bebas tekanan untuk semua level." },
      { property: "og:title", content: "Tentang Newton Badminton Club Malang" },
      { property: "og:description", content: "Komunitas mabar bulutangkis Kota Malang. Semua level welcome, Mabar No Pressure!" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KomunitasPage,
});

const SOCIALS = [
  { label: "Instagram", handle: BRAND.instagram.handle, url: BRAND.instagram.url },
  { label: "TikTok", handle: BRAND.tiktok.handle, url: BRAND.tiktok.url },
  { label: "X", handle: BRAND.x.handle, url: BRAND.x.url },
  { label: "WhatsApp Admin", handle: BRAND.waDisplay, url: BRAND.waShortLink },
];

function KomunitasPage() {
  return (
    <>
      <PageHero eyebrow={`Tentang Komunitas • Est. ${BRAND.est}`} title="Newton Badminton Club">
        “{BRAND.tagline}”
      </PageHero>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-5">
          <h2 className="display-title text-3xl text-navy sm:text-4xl">Cerita Kami</h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            Newton Badminton Club lahir di Kota Malang dengan visi sederhana: menciptakan ruang olahraga bulutangkis yang seru, suportif,
            terorganisir secara profesional, dan bebas tekanan (<em>No Pressure</em>). Dari pemula yang baru pegang raket sampai pemain
            kompetitif, semua dapat pasangan main yang seimbang!
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: Handshake, t: "All Levels Welcome", d: "Matchmaking seimbang sesuai skill level." },
              { icon: ShieldCheck, t: "Transparan & Modern", d: "Kuota real-time, kas & jadwal tertata." },
              { icon: Trophy, t: "Fun & Kompetitif", d: "Mabar mingguan & Mini Cup bulanan." },
            ].map((v) => (
              <div key={v.t} className="rounded-2xl border border-border bg-card p-4">
                <v.icon className="h-6 w-6 text-orange" />
                <p className="mt-3 text-sm font-bold text-navy">{v.t}</p>
                <p className="mt-1 text-xs text-muted-foreground">{v.d}</p>
              </div>
            ))}
          </div>
          <Button asChild variant="cta" size="lg">
            <Link to="/jadwal">Gabung Mabar Berikutnya</Link>
          </Button>
        </div>
        <div className="relative">
          <img src={communityImg} alt="Member Newton BC di lapangan" loading="lazy" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-lift" />
          <img src={logoUrl} alt="" className="animate-shuttle absolute -bottom-6 -left-4 h-24 w-24 rounded-2xl bg-card object-contain p-2 shadow-lift sm:h-28 sm:w-28" />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-6 sm:px-6 lg:grid-cols-2">
        <div className="surface-court space-y-3 rounded-3xl p-6">
          <h3 className="text-lg font-extrabold">Media Sosial & Kanal Resmi</h3>
          <p className="text-sm text-on-dark-muted">Update jadwal, dokumentasi foto/video, dan info turnamen terbaru.</p>
          <ul className="space-y-2">
            {SOCIALS.map((s) => (
              <li key={s.label}>
                <a href={s.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl bg-on-dark/10 p-3 text-sm transition-colors hover:bg-on-dark/20">
                  <span className="min-w-0 truncate"><span className="font-semibold">{s.label}</span> <span className="text-on-dark-muted">{s.handle}</span></span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-orange" />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4 rounded-3xl border border-border bg-card p-6">
          <h3 className="text-lg font-extrabold text-navy">Homebase</h3>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange" />
            <span><span className="font-semibold text-navy">{BRAND.venue.name}</span><br />{BRAND.venue.address}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="default"><a href={BRAND.venue.mapsUrl} target="_blank" rel="noreferrer"><MapPin /> Petunjuk Arah</a></Button>
            <Button asChild variant="whatsapp"><a href={BRAND.waShortLink} target="_blank" rel="noreferrer"><MessageCircle /> Chat Admin</a></Button>
          </div>
        </div>
      </section>
    </>
  );
}
