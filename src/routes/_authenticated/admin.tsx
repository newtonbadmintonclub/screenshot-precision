import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CalendarDays,
  Clock3,
  ClipboardList,
  RefreshCw,
  ShieldAlert,
  Ticket,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, formatRp } from "@/lib/brand";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Dashboard Admin — Newton BC" },
      { name: "description", content: "Ringkasan operasional Newton Badminton Club." },
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
  const { user, loading } = useAuth();
  const access = useAdminAccess();
  const isAdmin = access.data === true;
  const overview = useAdminOverview(isAdmin);

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
    { label: "Jadwal aktif & tersimpan", value: stats?.eventCount ?? 0, icon: CalendarDays, detail: "Total data sesi mabar" },
    { label: "Total booking", value: stats?.bookingCount ?? 0, icon: Ticket, detail: "Seluruh status booking" },
    { label: "Menunggu pembayaran", value: stats?.awaitingPaymentCount ?? 0, icon: Clock3, detail: "Perlu dipantau" },
    { label: "Pengajuan player", value: stats?.pendingRequestCount ?? 0, icon: ClipboardList, detail: "Permintaan berstatus pending" },
  ];

  return (
    <div className="min-h-[70vh] bg-muted/30">
      <div className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-teal">Newton BC • Operasional</p>
            <h1 className="display-title mt-1 text-3xl text-navy sm:text-4xl">Dashboard Admin</h1>
            <p className="mt-2 text-sm text-muted-foreground">Selamat bertugas, {user.email}. Ini ringkasan aktivitas klub.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1"><ShieldAlert className="h-3.5 w-3.5" /> Admin</Badge>
            <Button variant="outline" size="sm" onClick={() => overview.refetch()} disabled={overview.isFetching}>
              <RefreshCw className={overview.isFetching ? "animate-spin" : ""} /> Perbarui
            </Button>
          </div>
        </div>

        {overview.isError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Gagal memuat ringkasan: {overview.error.message}
          </div>
        ) : null}

        <section aria-label="Ringkasan operasional" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon, detail }) => (
            <Card key={label} className="rounded-2xl border-border/80 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardDescription className="max-w-[11rem] text-xs font-semibold">{label}</CardDescription>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-soft text-teal"><Icon className="h-4.5 w-4.5" /></span>
              </CardHeader>
              <CardContent>
                <div className="font-display text-3xl font-extrabold text-navy">{overview.isLoading ? "—" : value.toLocaleString("id-ID")}</div>
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="font-display text-lg text-navy">Booking terbaru</CardTitle>
              <CardDescription>Enam aktivitas pendaftaran terakhir.</CardDescription>
            </div>
            <Activity className="h-5 w-5 text-teal" />
          </CardHeader>
          <CardContent className="pt-0">
            {overview.isLoading ? (
              <div className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-muted" />)}</div>
            ) : stats?.recentBookings.length ? (
              <div className="divide-y divide-border">
                {stats.recentBookings.map((booking) => (
                  <div key={booking.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-navy">{booking.player_name}</p>
                      <p className="text-xs text-muted-foreground">{booking.code} • {formatDateTime(booking.created_at)}</p>
                    </div>
                    <p className="hidden text-sm font-semibold text-navy sm:block">{formatRp(booking.amount)}</p>
                    <Badge variant={booking.status === "confirmed" ? "secondary" : "outline"} className="justify-self-end whitespace-nowrap">
                      {STATUS_LABEL[booking.status] ?? booking.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Belum ada data booking.</p>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">Data diperbarui otomatis setiap 60 detik. Dashboard ini masih bersifat pemantauan; perubahan status dan tindakan operasional akan ditambahkan setelah alur otorisasi backend diaudit.</p>
      </div>
    </div>
  );
}

function AccessMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto grid min-h-[55vh] max-w-xl place-items-center px-4 py-12 text-center">
      <div className="space-y-3">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-warning-soft text-warning"><Users className="h-6 w-6" /></span>
        <h1 className="font-display text-2xl font-extrabold text-navy">{title}</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button asChild variant="outline" className="mt-2"><a href="/">Kembali ke beranda</a></Button>
      </div>
    </div>
  );
}
