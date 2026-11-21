import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { ArrowLeftRight, CalendarDays, Clock, Loader2, MapPin, QrCode, Send, ShoppingBag, Ticket, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrisPanel } from "@/components/mabar/QrisPanel";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-auth";
import { STATUS_META, canRequestChange, type BookingStatus } from "@/lib/booking-status";
import { formatDateTime, formatEventDate, formatRp, waLink } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tiket")({
  head: () => ({
    meta: [
      { title: "Tiket & Mabar Saya — Newton BC Malang" },
      { name: "description", content: "E-Ticket mabar, status pembayaran, pengajuan cancel & oper slot player Newton BC." },
      { property: "og:title", content: "Tiket & Mabar Saya — Newton BC" },
      { property: "og:description", content: "Kelola E-Ticket mabar Newton Badminton Club Malang." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TiketPage,
});

type MyBooking = {
  id: string;
  code: string;
  status: BookingStatus;
  payment_method: string | null;
  payment_expires_at: string | null;
  waitlist_position: number | null;
  amount: number;
  player_name: string;
  level: string;
  created_at: string;
  events: { title: string; starts_at: string; time_slots: string; venue: string; maps_url: string } | null;
};

function useMyBookings() {
  return useQuery({
    queryKey: ["my-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id,code,status,payment_method,payment_expires_at,waitlist_position,amount,player_name,level,created_at,events(title,starts_at,time_slots,venue,maps_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MyBooking[];
    },
  });
}

function useMyOrders() {
  return useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("id,code,product_name,quantity,size,total,status,created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function isActive(b: MyBooking) {
  if (b.status === "cancelled") return false;
  if (b.status === "awaiting_payment" && b.payment_expires_at && new Date(b.payment_expires_at) <= new Date()) return false;
  const start = b.events ? new Date(b.events.starts_at).getTime() : 0;
  return start > Date.now() - 4 * 3600_000;
}

function TiketPage() {
  const { data: profile } = useProfile();
  const bookings = useMyBookings();
  const orders = useMyOrders();
  const active = (bookings.data ?? []).filter(isActive);
  const history = (bookings.data ?? []).filter((b) => !isActive(b));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="eyebrow text-teal">Portal Player</p>
        <h1 className="display-title mt-1 text-3xl text-navy sm:text-4xl">Tiket & Mabar Saya</h1>
        {profile && (
          <p className="mt-1 text-sm text-muted-foreground">
            Halo, <span className="font-semibold text-navy">{profile.full_name || "Player"}</span> • {profile.level}
          </p>
        )}
      </div>

      <Tabs defaultValue="aktif">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
          <TabsTrigger value="aktif">Aktif ({active.length})</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat</TabsTrigger>
          <TabsTrigger value="pesanan">Pesanan</TabsTrigger>
        </TabsList>
        <TabsContent value="aktif" className="mt-5 space-y-4">
          {bookings.isLoading ? <ListSkeleton /> : active.length === 0 ? <EmptyTickets /> : active.map((b) => <TicketCard key={b.id} booking={b} />)}
        </TabsContent>
        <TabsContent value="riwayat" className="mt-5 space-y-4">
          {history.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Belum ada riwayat mabar.</p>
          ) : (
            history.map((b) => <TicketCard key={b.id} booking={b} past />)
          )}
        </TabsContent>
        <TabsContent value="pesanan" className="mt-5 space-y-3">
          {(orders.data ?? []).length === 0 ? (
            <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <ShoppingBag className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Belum ada pesanan store.</p>
              <Button asChild variant="outline" size="sm"><Link to="/store">Ke Club Store</Link></Button>
            </div>
          ) : (
            (orders.data ?? []).map((o) => (
              <div key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <div className="min-w-0">
                  <p className="truncate font-bold text-navy">{o.quantity}x {o.product_name}{o.size ? ` • ${o.size}` : ""}</p>
                  <p className="text-xs text-muted-foreground">{o.code} • {formatDateTime(o.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-display font-extrabold text-navy">{formatRp(o.total)}</p>
                  <p className="text-[11px] font-semibold text-orange">{o.status === "menunggu_pembayaran" ? "Menunggu Pembayaran" : o.status}</p>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1].map((i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted" />)}
    </div>
  );
}

function EmptyTickets() {
  return (
    <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <Ticket className="h-8 w-8 text-muted-foreground" />
      <p className="font-bold text-navy">Belum ada tiket aktif</p>
      <p className="text-sm text-muted-foreground">Yuk amankan slot di mabar berikutnya.</p>
      <Button asChild variant="cta"><Link to="/jadwal">Lihat Jadwal Mabar</Link></Button>
    </div>
  );
}

const TONE: Record<string, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  teal: "bg-teal-soft text-teal",
  orange: "bg-orange-soft text-orange",
  muted: "bg-muted text-muted-foreground",
};

function TicketCard({ booking: b, past = false }: { booking: MyBooking; past?: boolean }) {
  const meta = STATUS_META[b.status];
  const can = canRequestChange(b.status);
  const [dialog, setDialog] = useState<null | "cancel" | "swap" | "pay">(null);
  const expiredHold = b.status === "awaiting_payment" && b.payment_expires_at && new Date(b.payment_expires_at) <= new Date();

  return (
    <article className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-card", past && "opacity-75")}>
      <div className="grid sm:grid-cols-[minmax(0,1fr)_170px]">
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", TONE[meta.tone])}>
              {expiredHold ? "Waktu Bayar Habis" : meta.label}
              {b.status === "waiting_list" && b.waitlist_position ? ` #${b.waitlist_position}` : ""}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">{b.code}</span>
          </div>
          <h3 className="text-lg font-extrabold leading-tight text-navy">{b.events?.title ?? "Mabar"}</h3>
          {b.events && (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-teal" /> {formatEventDate(b.events.starts_at)}</p>
              <p className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-teal" /> {b.events.time_slots}</p>
              <a href={b.events.maps_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-navy"><MapPin className="h-4 w-4 shrink-0 text-orange" /> {b.events.venue}</a>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {b.player_name} • {b.level} • {b.payment_method === "qris" ? "QRIS" : b.payment_method === "transfer" ? "Transfer Manual" : "Waiting List"}
            {b.amount ? ` • ${formatRp(b.amount)}` : ""}
          </p>
          {!past && (
            <div className="flex flex-wrap gap-2 pt-1">
              {b.status === "awaiting_payment" && !expiredHold && (
                <Button variant="cta" size="sm" onClick={() => setDialog("pay")}><QrCode /> Lanjutkan Bayar QRIS</Button>
              )}
              {b.status === "pending_verification" && (
                <Button asChild variant="whatsapp" size="sm">
                  <a href={waLink(`Halo Admin Newton BC! Saya kirim bukti transfer tiket ${b.code} (${b.events?.title ?? "mabar"}) sebesar ${formatRp(b.amount)}.`)} target="_blank" rel="noreferrer"><Send /> Kirim Bukti TF</a>
                </Button>
              )}
              {can.swap && (
                <Button variant="outline" size="sm" onClick={() => setDialog("swap")}><ArrowLeftRight /> Oper Slot / Ganti Player</Button>
              )}
              {can.cancel && !expiredHold && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDialog("cancel")}>
                  <XCircle /> {b.status === "awaiting_payment" || b.status === "waiting_list" ? "Batalkan" : "Ajukan Cancel & Refund"}
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="ticket-perforation relative grid place-items-center border-t border-dashed border-border bg-muted/60 p-5 sm:border-l sm:border-t-0">
          {b.status === "confirmed" ? (
            <div className="text-center">
              <div className="rounded-xl bg-card p-2"><QRCode value={b.code} size={104} /></div>
              <p className="eyebrow mt-2 !text-[9px] text-navy">Tunjukkan saat check-in</p>
            </div>
          ) : (
            <div className="text-center">
              <Ticket className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-xs text-muted-foreground">E-Ticket aktif setelah terkonfirmasi</p>
            </div>
          )}
        </div>
      </div>
      <CancelDialog booking={b} open={dialog === "cancel"} onOpenChange={(o) => setDialog(o ? "cancel" : null)} />
      <SwapDialog booking={b} open={dialog === "swap"} onOpenChange={(o) => setDialog(o ? "swap" : null)} />
      <Dialog open={dialog === "pay"} onOpenChange={(o) => setDialog(o ? "pay" : null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="text-navy">Bayar QRIS • {b.code}</DialogTitle>
            <DialogDescription>{b.events?.title}</DialogDescription>
          </DialogHeader>
          {dialog === "pay" && <QrisPanel bookingId={b.id} />}
        </DialogContent>
      </Dialog>
    </article>
  );
}

function useChangeRequest(onDone: () => void) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function submit(args: { bookingId: string; type: "cancel" | "swap"; reason: string; name?: string; wa?: string }) {
    setBusy(true);
    const { error } = await supabase.rpc("request_booking_change", {
      _booking_id: args.bookingId,
      _request_type: args.type,
      _reason: args.reason,
      _replacement_name: args.name ?? "",
      _replacement_whatsapp: args.wa ?? "",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(args.type === "cancel" ? "Pengajuan cancel terkirim ke Admin" : "Pengajuan oper slot terkirim ke Admin");
    queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["events"] });
    onDone();
  }
  return { busy, submit };
}

function CancelDialog({ booking, open, onOpenChange }: { booking: MyBooking; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = useState("");
  const { busy, submit } = useChangeRequest(() => onOpenChange(false));
  const instant = booking.status === "awaiting_payment" || booking.status === "waiting_list";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-navy">{instant ? "Batalkan tiket?" : "Ajukan Cancel & Refund"}</DialogTitle>
          <DialogDescription>
            {instant ? "Slot / antrean kamu akan dilepas." : "Permintaan dikirim ke Admin. Refund diproses sesuai kebijakan klub setelah disetujui."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit({ bookingId: booking.id, type: "cancel", reason: reason.trim() || (instant ? "Dibatalkan player" : "") });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`reason-${booking.id}`}>Alasan {instant ? "(opsional)" : ""}</Label>
            <Textarea id={`reason-${booking.id}`} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Contoh: ada acara keluarga mendadak" required={!instant} minLength={instant ? undefined : 3} />
          </div>
          <Button type="submit" variant="destructive" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} {instant ? "Ya, Batalkan" : "Kirim Pengajuan"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SwapDialog({ booking, open, onOpenChange }: { booking: MyBooking; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  const [wa, setWa] = useState("");
  const [note, setNote] = useState("");
  const { busy, submit } = useChangeRequest(() => onOpenChange(false));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-navy">Oper Slot / Ganti Player</DialogTitle>
          <DialogDescription>Isi data player pengganti. Admin akan verifikasi dan memindahkan tiket {booking.code}.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit({ bookingId: booking.id, type: "swap", reason: note.trim(), name: name.trim(), wa: wa.trim() });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`swap-name-${booking.id}`}>Nama player pengganti</Label>
            <Input id={`swap-name-${booking.id}`} required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`swap-wa-${booking.id}`}>No. WhatsApp pengganti</Label>
            <Input id={`swap-wa-${booking.id}`} required inputMode="tel" pattern="[0-9+ \-]{8,20}" maxLength={20} placeholder="08xxxxxxxxxx" value={wa} onChange={(e) => setWa(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`swap-note-${booking.id}`}>Catatan (opsional)</Label>
            <Textarea id={`swap-note-${booking.id}`} maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button type="submit" variant="default" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Kirim Pengajuan
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
