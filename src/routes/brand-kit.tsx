import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { CopyButton } from "@/components/mabar/CopyButton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
const logoUrl = "/favicon.png";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/brand-kit")({
  head: () => ({
    meta: [
      { title: "Brand Kit — Newton Badminton Club Malang" },
      { name: "description", content: "Logo, kode warna resmi, dan caption siap pakai untuk promosi Newton Badminton Club Malang." },
      { property: "og:title", content: "Brand Kit — Newton Badminton Club Malang" },
      { property: "og:description", content: "Unduh logo, salin kode warna, dan pakai caption promo mabar Newton BC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BrandKitPage,
});

const COLORS = [
  { name: "Dark Navy", role: "Primary", hex: "#0F2544", swatch: "bg-navy", text: "text-on-dark" },
  { name: "Bright Teal", role: "Secondary", hex: "#0E9AA7", swatch: "bg-teal", text: "text-on-dark" },
  { name: "Vibrant Orange", role: "Accent / CTA", hex: "#F27405", swatch: "bg-orange", text: "text-on-dark" },
  { name: "Clean Light", role: "Background", hex: "#F8FAFC", swatch: "bg-background ring-1 ring-border", text: "text-navy" },
];

const CAPTIONS = [
  {
    title: "Template Broadcast WhatsApp",
    text: `🏸 *JOIN MABAR BULUTANGKIS*\n_bareng Newton Badminton Club Malang_\n🔥 *${BRAND.tagline}*\n\n📅 *[Hari, Tanggal]*\n⏰ 19.00–22.00 (Lap B & D) | 20.00–22.00 (Lap A)\n📍 *GALAXY BADMINTON ARENA*\n${BRAND.venue.address}\n🗺️ ${BRAND.venue.mapsUrl}\n\n👥 Kuota: 26 Player | 🎟️ HTM: Rp 20.000\n📲 Daftar Web: ${BRAND.domain}\n📲 WA Admin: ${BRAND.waShortLink}`,
  },
  {
    title: "Caption Instagram / TikTok",
    text: `Smash bareng, ketawa bareng 🏸🔥\nMabar rutin tiap minggu di Galaxy Badminton Arena Malang — semua level welcome, dari pemula sampai jago!\n\n🎟️ Rp 20.000/sesi • 26 slot\n📲 Daftar: ${BRAND.domain}\n\n${BRAND.tagline}\n\n#NewtonBC #BadmintonMalang #MabarMalang #BulutangkisMalang #MalangSemuaTeman`,
  },
  {
    title: "Bio Singkat",
    text: `🏸 Newton Badminton Club Malang • Est. ${BRAND.est}\n“${BRAND.tagline}”\n📍 Galaxy Badminton Arena\n📲 ${BRAND.domain}`,
  },
];

function BrandKitPage() {
  return (
    <>
      <PageHero eyebrow="Untuk Member & Partner" title="Brand Kit">
        Aset resmi Newton BC — tinggal salin atau unduh untuk promosi mabar, story, dan kolaborasi.
      </PageHero>
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4 rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-extrabold text-navy">Logo Resmi</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid aspect-square place-items-center rounded-2xl bg-background p-4 ring-1 ring-border">
              <img src={logoUrl} alt="Logo Newton Badminton Club" className="h-full w-full object-contain" />
            </div>
            <div className="surface-court grid aspect-square place-items-center rounded-2xl p-4">
              <img src={logoUrl} alt="Logo Newton Badminton Club di latar gelap" className="h-full w-full object-contain" />
            </div>
          </div>
          <Button asChild variant="default" className="w-full">
            <a href={logoUrl} download="newton-badminton-club-logo.png"><Download /> Unduh Logo (PNG transparan)</a>
          </Button>
          <div className="space-y-2 pt-2">
            <p className="text-sm font-bold text-navy">Tipografi</p>
            <p className="font-display text-2xl font-extrabold uppercase text-navy">Plus Jakarta Sans</p>
            <p className="text-sm text-muted-foreground">Inter — untuk teks isi yang mudah dibaca.</p>
          </div>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {COLORS.map((c) => (
              <div key={c.hex} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className={cn("grid h-24 place-items-end p-3", c.swatch, c.text)}>
                  <span className="eyebrow !text-[9px]">{c.role}</span>
                </div>
                <div className="space-y-2 p-3">
                  <p className="text-sm font-bold text-navy">{c.name}</p>
                  <CopyButton text={c.hex} label={c.hex} toastLabel={`Kode ${c.name}`} size="sm" className="w-full font-mono" />
                </div>
              </div>
            ))}
          </div>
          {CAPTIONS.map((c) => (
            <div key={c.title} className="space-y-3 rounded-3xl border border-border bg-card p-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <h3 className="truncate text-base font-extrabold text-navy">{c.title}</h3>
                <CopyButton text={c.text} label="Salin" toastLabel={c.title} size="sm" />
              </div>
              <Textarea readOnly value={c.text} rows={8} className="font-mono text-xs" aria-label={c.title} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
