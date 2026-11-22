import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, CalendarClock, CheckCheck, CreditCard, Info, ListOrdered, MessageSquareReply, ShoppingBag, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/newton-client";
import { formatDateTime } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifikasi")({
  head: () => ({
    meta: [
      { title: "Notifikasi — Newton BC Malang" },
      { name: "description", content: "Konfirmasi booking, verifikasi pembayaran, waiting list, dan pengingat mabar Newton BC." },
      { property: "og:title", content: "Notifikasi Player — Newton BC" },
      { property: "og:description", content: "Kotak masuk player Newton Badminton Club Malang." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotifikasiPage,
});

const ICONS: Record<string, { icon: typeof Bell; cls: string }> = {
  booking: { icon: Ticket, cls: "bg-success-soft text-success" },
  payment: { icon: CreditCard, cls: "bg-warning-soft text-warning" },
  waitlist: { icon: ListOrdered, cls: "bg-teal-soft text-teal" },
  reminder: { icon: CalendarClock, cls: "bg-orange-soft text-orange" },
  request: { icon: MessageSquareReply, cls: "bg-muted text-navy" },
  order: { icon: ShoppingBag, cls: "bg-orange-soft text-orange" },
  info: { icon: Info, cls: "bg-teal-soft text-teal" },
};

function NotifikasiPage() {
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications", "list"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const items = q.data ?? [];
  const unread = items.filter((n) => !n.is_read).length;

  async function markRead(ids: string[]) {
    if (!ids.length) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <p className="eyebrow text-teal">Portal Player</p>
          <h1 className="display-title mt-1 text-3xl text-navy sm:text-4xl">Notifikasi</h1>
          <p className="mt-1 text-sm text-muted-foreground">{unread ? `${unread} belum dibaca` : "Semua sudah dibaca"}</p>
        </div>
        <Button variant="outline" size="sm" disabled={!unread} onClick={() => markRead(items.filter((n) => !n.is_read).map((n) => n.id))}>
          <CheckCheck /> Tandai dibaca
        </Button>
      </div>

      {q.isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : items.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <BellRing className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Belum ada notifikasi.</p>
          <Button asChild variant="cta" size="sm"><Link to="/jadwal">Cari Jadwal Mabar</Link></Button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((n) => {
            const meta = ICONS[n.kind] ?? ICONS["info"]!;
            const Icon = meta.icon;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => !n.is_read && markRead([n.id])}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                    n.is_read ? "border-border bg-card" : "border-teal/30 bg-teal-soft/60",
                  )}
                >
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", meta.cls)}><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-bold text-navy">{n.title}</span>
                      {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange" aria-label="Belum dibaca" />}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{n.message}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">{formatDateTime(n.created_at)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
