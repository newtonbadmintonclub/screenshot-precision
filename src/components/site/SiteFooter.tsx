import { Link } from "@tanstack/react-router";
import { MapPin, MessageCircle } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="surface-court mt-16">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo onDark />
          <p className="max-w-sm font-display text-lg font-bold leading-snug">“{BRAND.tagline}”</p>
          <p className="flex items-start gap-2 text-sm text-on-dark-muted">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange" />
            <span>
              Homebase: {BRAND.venue.name}, {BRAND.venue.address}
            </span>
          </p>
        </div>
        <div>
          <p className="eyebrow mb-3 text-teal">Jelajahi</p>
          <ul className="space-y-2 text-sm text-on-dark-muted">
            <li><Link to="/jadwal" className="hover:text-on-dark">Jadwal Mabar</Link></li>
            <li><Link to="/store" className="hover:text-on-dark">Club Store</Link></li>
            <li><Link to="/komunitas" className="hover:text-on-dark">Tentang Komunitas</Link></li>
            <li><Link to="/brand-kit" className="hover:text-on-dark">Brand Kit</Link></li>
            <li><Link to="/tiket" className="hover:text-on-dark">Tiket Saya</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-3 text-teal">Kontak & Sosial</p>
          <ul className="space-y-2 text-sm text-on-dark-muted">
            <li>
              <a href={BRAND.waShortLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-on-dark">
                <MessageCircle className="h-4 w-4 text-whatsapp" /> WA Admin {BRAND.waDisplay}
              </a>
            </li>
            <li><a href={BRAND.instagram.url} target="_blank" rel="noreferrer" className="hover:text-on-dark">Instagram {BRAND.instagram.handle}</a></li>
            <li><a href={BRAND.tiktok.url} target="_blank" rel="noreferrer" className="hover:text-on-dark">TikTok {BRAND.tiktok.handle}</a></li>
            <li><a href={BRAND.x.url} target="_blank" rel="noreferrer" className="hover:text-on-dark">X {BRAND.x.handle}</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-on-dark/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-on-dark-muted sm:px-6">
          © 2026 {BRAND.name} • {BRAND.domain}
        </p>
      </div>
    </footer>
  );
}
