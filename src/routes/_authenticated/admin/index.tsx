import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Bot,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Swords,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/site/Logo";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, formatRp } from "@/lib/brand";
import { supabase } from "@/lib/newton-client";
import { MembershipPanel } from "@/components/admin/MembershipPanel";
import { SchedulePanel } from "@/components/admin/SchedulePanel";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard Admin — Newton BC" },
      { name: "description", content: "Kelola operasional Newton Badminton Club." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboardPage,
});

type RecentBooking = {
  id: string;
  code: string;
  player_name: string;
  status: string;
  amount: number;
  created_at: string;
};

const ADMIN_MENU = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, description: "Ringkasan aktivitas klub" },
  { id: "membership", label: "Membership", icon: Users, description: "Database dan status keanggotaan pemain" },
  { id: "ai-sync", label: "AI Agent & Omnichannel Sync", icon: Bot, description: "Otomatisasi sinkronisasi lintas kanal" },
  { id: "events", label: "Jadwal Mabar", icon: CalendarDays, description: "Kelola sesi dan jadwal bermain" },
  { id: "bookings", label: "Booking", icon: Ticket, description: "Pendaftaran dan transaksi booking" },
  { id: "waiting-list", label: "Waiting List", icon: ListChecks, description: "Antrean peserta pada sesi penuh" },
  { id: "matchmaking", label: "Matchmaking", icon: Swords, description: "Pencocokan pemain dan level permainan" },
  { id: "finance", label: "Keuangan", icon: Wallet, description: "Pembayaran, pemasukan, dan rekap" },
  { id: "inventory", label: "Inventaris", icon: Boxes, description: "Perlengkapan dan stok operasional klub" },
  { id: "store", label: "Club Store", icon: ShoppingBag, description: "Produk, stok, dan pesanan toko" },
] as const;

type AdminSection = (typeof ADMIN_MENU)[number]["id"];

function useAdminAccess() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["admin-access", user?.id],
    enabled: !!user,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).some(({ role }) => role === "admin");
    },
  });
}

function useAdminOverview(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-overview"],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [events, bookings, awaitingPayment, pendingRequests, recent] = await Promise.all([
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "awaiting_payment"),
        supabase.from("booking_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase
          .from("bookings")
          .select("id,code,player_name,status,amount,created_at")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      const result = [events, bookings, awaitingPayment, pendingRequests, recent];
      const failed = result.find((item) => item.error);
      if (failed?.error) throw failed.error;

      return {
        eventCount: events.count ?? 0,
        bookingCount: bookings.count ?? 0,
        awaitingPaymentCount: awaitingPayment.count ?? 0,
        pendingRequestCount: pendingRequests.count ?? 0,
        recentBookings: (recent.data ?? []) as RecentBooking[],
      };
    },
  });
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Terkonfirmasi",
  awaiting_payment: "Menunggu pembayaran",
  pending_verification: "Verifikasi transfer",
  waiting_list: "Waiting list",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
};

function AdminDashboardPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const access = useAdminAccess();
  const isAdmin = access.data === true;
  const overview = useAdminOverview(isAdmin);
  const activeMenu = ADMIN_MENU.find((item) => item.id === activeSection) ?? ADMIN_MENU[0];
  const displayName = user?.email?.split("@")[0]?.replace(/[._-]/g, " ") ?? "Admin";

  if (loading || access.isLoading) {
    return <div className="mx-auto max-w-6xl px-4 py-12"><div className="h-8 w-56 animate-pulse rounded bg-muted" /><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl bg-muted" />)}</div></div>;
  }

  if (!user) {
    return <AccessMessage title="Silakan masuk" message="Dashboard operasional hanya tersedia untuk akun Admin Newton BC." />;
  }
  if (access.isError) {
    return <AccessMessage title="Akses belum dapat diverifikasi" message={access.error.message} />;
  }
  if (!isAdmin) {
    return <AccessMessage title="Akses terbatas" message="Akun ini belum memiliki role Admin. Hubungi pemilik klub untuk pengaturan akses." />;
  }

  const stats = overview.data;
  const cards = [
    { label: "Jadwal mabar", value: stats?.eventCount ?? 0, icon: CalendarDays, detail: "Total data sesi mabar" },
    { label: "Total booking", value: stats?.bookingCount ?? 0, icon: Ticket, detail: "Seluruh status booking" },
    { label: "Menunggu pembayaran", value: stats?.awaitingPaymentCount ?? 0, icon: Clock3, detail: "Perlu dipantau" },
    { label: "Pengajuan pemain", value: stats?.pendingRequestCount ?? 0, icon: ClipboardList, detail: "Permintaan berstatus pending" },
  ];

  function openMembership() {
    setActiveSection("membership");
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f3f5f7]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1600px]">
        <aside className="hidden w-[238px] shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 lg:flex">
          <div className="px-2 pb-7"><Logo className="gap-3" /></div>
          <nav className="flex-1 space-y-1" aria-label="Menu Dashboard Admin">
            {ADMIN_MENU.map(({ id, label, icon: Icon }) => {
              const active = activeSection === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => (id === "ai-sync" ? void navigate({ to: "/admin/ai-sync" }) : setActiveSection(id))}
                  aria-current={active ? "page" : undefined}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition-colors ${active ? "bg-[#142b4d] text-white shadow-sm" : "text-slate-700 hover:bg-slate-100 hover:text-[#142b4d]"}`}
                >
                  <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-white" : "text-slate-500 group-hover:text-[#142b4d]"}`} />
                  <span>{label}</span>
                  {id === "bookings" && (stats?.awaitingPaymentCount ?? 0) > 0 && (
                    <span className="ml-auto rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{stats?.awaitingPaymentCount}</span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="mt-6 rounded-2xl bg-slate-100 p-3">
            <p className="text-xs font-bold text-slate-800">Akses cepat</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Tambahkan pemain baru ke database Membership.</p>
            <Button onClick={openMembership} className="mt-3 h-9 w-full bg-orange-500 text-xs font-bold text-white hover:bg-orange-600">
              <Plus className="mr-1 h-4 w-4" /> Tambah Pemain
            </Button>
          </div>
          <div className="mt-5 flex items-center gap-3 border-t border-slate-100 px-1 pt-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e2edf0] text-xs font-extrabold uppercase text-[#142b4d]">{displayName.slice(0, 2)}</span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-bold capitalize text-slate-800">{displayName}</span>
              <span className="block text-[10px] text-slate-500">Admin Operasional</span>
            </span>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-7 lg:py-7">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal">Newton Badminton Club • Admin Hub</p>
              <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#142b4d] sm:text-[28px]">{activeMenu.label}</h1>
              <p className="mt-1 text-sm text-slate-500">{activeSection === "overview" ? "Kelola aktivitas operasional Newton Badminton Club Malang" : activeMenu.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="hidden h-10 w-56 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-slate-400 md:flex">
                <Search className="h-4 w-4 shrink-0" />
                <input aria-label="Cari di dashboard" placeholder="Cari menu atau data..." className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400" />
              </label>
              <Button variant="outline" size="icon" aria-label="Notifikasi" className="relative h-10 w-10 rounded-full border-slate-200 bg-white text-slate-600">
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-orange-500" />
              </Button>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#dce9ec] text-xs font-bold uppercase text-[#142b4d]">{displayName.slice(0, 2)}</span>
            </div>
          </header>

          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {ADMIN_MENU.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => (id === "ai-sync" ? void navigate({ to: "/admin/ai-sync" }) : setActiveSection(id))} className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${activeSection === id ? "bg-[#142b4d] text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>

          {activeSection === "membership" ? (
            <MembershipPanel />
          ) : activeSection === "events" ? (
            <SchedulePanel />
          ) : activeSection === "overview" ? (
            <OverviewPanel
              cards={cards}
              isLoading={overview.isLoading}
              isFetching={overview.isFetching}
              isError={overview.isError}
              errorMessage={overview.error?.message}
              recentBookings={stats?.recentBookings ?? []}
              onRefresh={() => overview.refetch()}
              onOpenMembership={openMembership}
              onOpenBookings={() => setActiveSection("bookings")}
            />
          ) : (
            <SectionPlaceholder section={activeSection} title={activeMenu.label} description={activeMenu.description} onBack={() => setActiveSection("overview")} />
          )}
        </main>
      </div>
    </div>
  );
}

type OverviewCard = { label: string; value: number; icon: typeof CalendarDays; detail: string };

function OverviewPanel({
  cards,
  isLoading,
  isFetching,
  isError,
  errorMessage,
  recentBookings,
  onRefresh,
  onOpenMembership,
  onOpenBookings,
}: {
  cards: OverviewCard[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage?: string | undefined;
  recentBookings: RecentBooking[];
  onRefresh: () => void;
  onOpenMembership: () => void;
  onOpenBookings: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isFetching} className="rounded-lg border-slate-200 bg-white text-slate-700">
          <RefreshCw className={isFetching ? "animate-spin" : ""} /> Perbarui data
        </Button>
        <Button onClick={onOpenMembership} size="sm" className="rounded-lg bg-orange-500 font-bold text-white hover:bg-orange-600">
          <Plus /> Tambah Pemain
        </Button>
      </div>

      {isError && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Gagal memuat ringkasan: {errorMessage}</div>}

      <section aria-label="Ringkasan operasional" className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, detail }, index) => (
          <Card key={label} className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardDescription className="max-w-[12rem] text-xs font-semibold text-slate-600">{label}</CardDescription>
              <span className={`grid h-9 w-9 place-items-center rounded-xl ${["bg-purple-50 text-purple-600", "bg-sky-50 text-sky-600", "bg-emerald-50 text-emerald-600", "bg-orange-50 text-orange-600"][index]}`}><Icon className="h-4 w-4" /></span>
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-extrabold text-[#142b4d]">{isLoading ? "—" : value.toLocaleString("id-ID")}</div>
              <p className="mt-1 text-xs text-slate-500">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <button type="button" onClick={onOpenBookings} className="flex w-full items-center gap-3 rounded-xl border border-teal-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-teal-400">
        <Sparkles className="h-5 w-5 shrink-0 text-teal" />
        <span className="min-w-0 flex-1 text-xs text-slate-700"><strong className="font-bold text-[#142b4d]">Pusat operasional:</strong> buka Booking untuk meninjau pendaftaran dan status pembayaran.</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <CardTitle className="font-display text-lg text-[#142b4d]">Booking terbaru</CardTitle>
            <CardDescription>Enam aktivitas pendaftaran terakhir.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onOpenBookings} className="text-xs font-semibold text-teal">Lihat semua <ChevronRight className="ml-1 h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="pt-2">
          {isLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-muted" />)}</div>
          ) : recentBookings.length ? (
            <div className="divide-y divide-slate-100">
              {recentBookings.map((booking) => (
                <div key={booking.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-2 last:pb-1 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#142b4d]">{booking.player_name}</p>
                    <p className="text-xs text-slate-500">{booking.code} • {formatDateTime(booking.created_at)}</p>
                  </div>
                  <p className="hidden text-sm font-semibold text-[#142b4d] sm:block">{formatRp(booking.amount)}</p>
                  <Badge variant={booking.status === "confirmed" ? "secondary" : "outline"} className="justify-self-end whitespace-nowrap">{STATUS_LABEL[booking.status] ?? booking.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Belum ada data booking.</p>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-slate-500">Data diperbarui otomatis setiap 60 detik. Menu operasional akan diaktifkan bertahap setelah setiap alur dan otorisasi backend selesai dibangun.</p>
    </div>
  );
}

function SectionPlaceholder({ section, title, description, onBack }: { section: AdminSection; title: string; description: string; onBack: () => void }) {
  const detail: Record<AdminSection, string> = {
    overview: "Ringkasan aktivitas klub.",
    membership: "Area ini akan menjadi satu database pemain dan keanggotaan: profil, level, status membership, riwayat mabar, serta informasi kontak. Menu Peserta dan Manajemen Member digabung di sini.",
    events: "Kelola jadwal sesi mabar, kapasitas, lokasi, harga, publikasi, dan status pendaftaran.",
    bookings: "Kelola semua booking secara terpisah dari database Membership, termasuk detail pendaftar, status, dan riwayat transaksi.",
    "waiting-list": "Pantau antrean pemain ketika kuota sesi mabar sudah terpenuhi.",
    matchmaking: "Kelola pencocokan pemain berdasarkan level, preferensi, dan kebutuhan sesi.",
    finance: "Pantau pembayaran, pemasukan, pengeluaran, dan laporan keuangan klub.",
    inventory: "Catat perlengkapan klub, jumlah stok, kondisi, dan pergerakan inventaris.",
    store: "Kelola katalog produk, stok toko, pesanan, dan penjualan Club Store.",
    "ai-sync": "Sinkronisasi pesan omnichannel dengan bantuan AI.",
  };
  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardContent className="flex min-h-[340px] flex-col items-center justify-center px-6 py-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#e8f5f5] text-teal"><CheckCircle2 className="h-7 w-7" /></span>
        <Badge variant="outline" className="mt-5 border-teal-200 bg-teal-50 text-teal">Struktur menu disiapkan</Badge>
        <h2 className="mt-3 font-display text-2xl font-extrabold text-[#142b4d]">{title}</h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500">{detail[section]}</p>
        <p className="mt-3 text-xs text-slate-400">{description}</p>
        <Button variant="outline" onClick={onBack} className="mt-6 border-slate-200">Kembali ke Overview</Button>
      </CardContent>
    </Card>
  );
}

function AccessMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto grid min-h-[55vh] max-w-xl place-items-center px-4 py-12 text-center">
      <div className="space-y-3">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-warning-soft text-warning"><ShieldCheck className="h-6 w-6" /></span>
        <h1 className="font-display text-2xl font-extrabold text-navy">{title}</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button asChild variant="outline" className="mt-2"><a href="/">Kembali ke beranda</a></Button>
      </div>
    </div>
  );
}
