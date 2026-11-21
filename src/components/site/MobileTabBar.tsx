import { Link } from "@tanstack/react-router";
import { CalendarDays, Home, ShoppingBag, Ticket, Users } from "lucide-react";

const TABS = [
  { to: "/", label: "Beranda", icon: Home },
  { to: "/jadwal", label: "Jadwal", icon: CalendarDays },
  { to: "/tiket", label: "Tiket", icon: Ticket },
  { to: "/store", label: "Store", icon: ShoppingBag },
  { to: "/komunitas", label: "Komunitas", icon: Users },
] as const;

export function MobileTabBar() {
  return (
    <nav
      aria-label="Navigasi bawah"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="group flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-muted-foreground data-[status=active]:text-navy"
            >
              <span className="grid h-7 w-12 place-items-center rounded-full transition-colors group-data-[status=active]:bg-teal-soft group-data-[status=active]:text-teal">
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
