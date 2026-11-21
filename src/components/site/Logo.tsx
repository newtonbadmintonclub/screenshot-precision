import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
export const logoUrl = "/favicon.png";
export function Logo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return <Link to="/" className={cn("flex min-w-0 items-center gap-2.5", className)} aria-label="Newton Badminton Club Malang — Beranda"><img src={logoUrl} alt="" className="h-10 w-10 shrink-0 object-contain" width={40} height={40}/><span className="min-w-0 leading-none"><span className={cn("block truncate font-display text-[15px] font-extrabold uppercase tracking-tight",onDark?"text-on-dark":"text-navy")}>Newton BC</span><span className={cn("eyebrow block truncate !text-[9px]",onDark?"text-on-dark-muted":"text-teal")}>Malang</span></span></Link>;
}
