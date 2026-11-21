import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, ShieldCheck, Ticket, UserRound } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, useProfile, useUnreadCount } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/", label: "Beranda" },
  { to: "/jadwal", label: "Jadwal Mabar" },
  { to: "/store", label: "Club Store" },
  { to: "/komunitas", label: "Komunitas" },
  { to: "/brand-kit", label: "Brand Kit" },
] as const;

export function SiteHeader() {
  const { user, loading } = useAuth();
  const { data: profile } = useProfile();
  const { data: unread = 0 } = useUnreadCount();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: hasAdminAccess = false } = useQuery({
    queryKey: ["current-role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).some(({ role }) => role === "admin");
    },
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const name = profile?.full_name || user?.email?.split("@")[0] || "Player";
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-lg">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:px-6 lg:grid-cols-[auto_1fr_auto]">
        <Logo />
        <nav className="hidden items-center justify-center gap-1 lg:flex" aria-label="Navigasi utama">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-navy data-[status=active]:bg-muted data-[status=active]:text-navy"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          {loading ? (
            <div className="h-10 w-24" />
          ) : user ? (
            <>
              <Button asChild variant="ghost" size="icon" aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`} className="relative">
                <Link to="/notifikasi">
                  <Bell className="!size-5" />
                  {unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-orange px-1 text-[10px] font-bold text-accent-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
              </Button>
              <Button asChild variant="outline" className="hidden sm:inline-flex">
                <Link to="/tiket">
                  <Ticket /> Tiket Saya
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy font-display text-sm font-bold text-on-dark ring-2 ring-teal/30"
                    aria-label="Menu akun"
                  >
                    {initials}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">
                    {name}
                    <span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/tiket">
                      <Ticket /> Tiket & Mabar Saya
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/notifikasi">
                      <Bell /> Notifikasi
                    </Link>
                  </DropdownMenuItem>
                  {hasAdminAccess && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/admin">
                          <ShieldCheck /> Dashboard Admin
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onSelect={handleSignOut}>
                    <LogOut /> Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link to="/auth">
                  <UserRound /> Masuk
                </Link>
              </Button>
              <Button asChild variant="cta">
                <Link to="/jadwal">Daftar Mabar</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
