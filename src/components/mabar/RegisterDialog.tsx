import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { CheckCircle2, Hourglass, Landmark, Loader2, LogIn, MessageCircle, MonitorSmartphone, QrCode, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyButton } from "./CopyButton";
import { QrisPanel } from "./QrisPanel";
import { QuotaBar } from "./QuotaBar";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { supabase } from "@/lib/newton-client";
import { BRAND, LEVELS, TRANSFER_ACCOUNT, formatEventDate, formatRp, waLink, waRegistrationText, type Level } from "@/lib/brand";
import type { PublicEvent } from "@/lib/public.functions";
import { quotaState } from "@/lib/booking-status";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 huruf").max(80, "Nama terlalu panjang"),
  whatsapp: z.string().trim().regex(/^[0-9+ -]{8,20}$/, "Nomor WhatsApp tidak valid"),
  level: z.enum(LEVELS),
});

type Booking = { id: string; code: string; status: string; waitlist_position: number | null; amount: number };

export function RegisterDialog({
  event,
  initialTab,
  open,
  onOpenChange,
}: {
  event: PublicEvent | null;
  initialTab: "web" | "wa";
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [tab, setTab] = useState<"web" | "wa">(initialTab);
  useEffect(() => setTab(initialTab), [initialTab, event?.id]);

  if (!event) return null;
  const q = quotaState(event.filled, event.quota_max);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl p-0 sm:max-w-lg">
        <div className="surface-court rounded-t-2xl p-5">
          <DialogHeader className="space-y-1 text-left">
            <p className="eyebrow text-teal">{event.event_type} • {formatRp(event.price)}</p>
            <DialogTitle className="text-xl font-extrabold text-on-dark">{event.title}</DialogTitle>
            <DialogDescription className="text-on-dark-muted">
              {formatEventDate(event.starts_at)} • {event.time_slots}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <QuotaBar filled={event.filled} quotaMax={event.quota_max} waitlist={event.waitlist} onDark />
          </div>
        </div>
        <div className="p-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "web" | "wa")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="web"><MonitorSmartphone className="mr-1.5 h-4 w-4" /> Via Website</TabsTrigger>
              <TabsTrigger value="wa"><MessageCircle className="mr-1.5 h-4 w-4" /> Via WhatsApp</TabsTrigger>
            </TabsList>
            <TabsContent value="web" className="pt-4">
              <WebRegistration event={event} isFull={q.isFull} onDone={() => onOpenChange(false)} />
            </TabsContent>
            <TabsContent value="wa" className="pt-4">
              <WaRegistration event={event} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WaRegistration({ event }: { event: PublicEvent }) {
  const { data: profile } = useProfile();
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>("Intermediate");
  useEffect(() => {
    if (profile?.full_name) setName((n) => n || profile.full_name);
    if (profile?.level) setLevel(profile.level as Level);
  }, [profile]);

  const text = useMemo(
    () =>
      waRegistrationText({
        eventTitle: event.title,
        dateLabel: formatEventDate(event.starts_at),
        timeSlots: event.time_slots,
        price: event.price,
        name: name.trim().slice(0, 80),
        level,
      }),
    [event, name, level],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="wa-name">Nama</Label>
          <Input id="wa-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Nama kamu" />
        </div>
        <div className="space-y-1.5">
          <Label>Level</Label>
          <LevelSelect value={level} onChange={setLevel} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wa-preview">Format pendaftaran</Label>
        <Textarea id="wa-preview" readOnly value={text} rows={10} className="font-mono text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CopyButton text={text} label="Salin Format" toastLabel="Format pendaftaran" />
        <Button asChild variant="whatsapp">
          <a href={waLink(text)} target="_blank" rel="noreferrer">
            <Send /> Kirim ke Admin
          </a>
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">WA Admin {BRAND.waDisplay}</p>
    </div>
  );
}

function LevelSelect({ value, onChange }: { value: Level; onChange: (l: Level) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Level)}>
      <SelectTrigger className="w-[140px]" aria-label="Level main">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LEVELS.map((l) => (
          <SelectItem key={l} value={l}>{l}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function WebRegistration({ event, isFull, onDone }: { event: PublicEvent; isFull: boolean; onDone: () => void }) {
  const { user, loading } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [level, setLevel] = useState<Level>("Intermediate");
  const [method, setMethod] = useState<"qris" | "transfer">("qris");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (!profile) return;
    setName((n) => n || profile.full_name);
    setWhatsapp((w) => w || profile.whatsapp);
    if (profile.level) setLevel(profile.level as Level);
  }, [profile]);

  if (loading) return <div className="h-40" />;

  if (!user) {
    return (
      <div className="space-y-4 rounded-2xl bg-muted p-5 text-center">
        <LogIn className="mx-auto h-8 w-8 text-teal" />
        <div>
          <p className="font-bold text-navy">Login dulu untuk daftar via website</p>
          <p className="mt-1 text-sm text-muted-foreground">Dapat E-Ticket, cek kuota otomatis, bayar QRIS instan, dan notifikasi status.</p>
        </div>
        <Button asChild variant="cta" size="lg" className="w-full">
          <Link to="/auth" search={{ redirect: "/jadwal" }}>Masuk / Daftar Akun</Link>
        </Button>
      </div>
    );
  }

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ["events"] });
    queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function book(payment: "qris" | "transfer" | null) {
    const parsed = formSchema.safeParse({ name, whatsapp, level });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
      setErrors(errs);
      return null;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("book_event", {
        _event_id: event.id,
        _player_name: parsed.data.name,
        _whatsapp: parsed.data.whatsapp,
        _level: parsed.data.level,
        _payment_method: payment ?? "",
      });
      if (error) throw error;
      await supabase
        .from("profiles")
        .update({ full_name: parsed.data.name, whatsapp: parsed.data.whatsapp, level: parsed.data.level, updated_at: new Date().toISOString() })
        .eq("id", user!.id);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      refreshAll();
      const b = data as unknown as Booking;
      setBooking(b);
      return b;
    } catch (e) {
      toast.error((e as Error).message || "Pendaftaran gagal");
      refreshAll();
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function switchToTransfer() {
    if (!booking) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("request_booking_change", {
      _booking_id: booking.id,
      _request_type: "cancel",
      _reason: "Ganti metode ke transfer manual",
      _replacement_name: "",
      _replacement_whatsapp: "",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMethod("transfer");
    await book("transfer");
  }

  if (booking) {
    if (booking.status === "awaiting_payment") {
      return (
        <div className="space-y-4">
          <QrisPanel bookingId={booking.id} onSwitchToTransfer={switchToTransfer} switching={submitting} />
          <Button asChild variant="outline" className="w-full"><Link to="/tiket">Lihat Tiket Saya</Link></Button>
        </div>
      );
    }
    if (booking.status === "pending_verification") {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl bg-warning-soft p-5">
            <p className="flex items-center gap-2 font-bold text-navy"><Hourglass className="h-5 w-5 text-warning" /> Menunggu Verifikasi</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Slot kamu sudah ditahan dengan kode <span className="font-bold text-navy">{booking.code}</span>. Transfer {formatRp(booking.amount)} lalu unggah bukti melalui halaman Tiket Saya.
            </p>
            {TRANSFER_ACCOUNT ? (
              <div className="mt-3 rounded-xl bg-card p-3 text-sm">
                <p className="font-semibold text-navy">{TRANSFER_ACCOUNT.bank} • {TRANSFER_ACCOUNT.number}</p>
                <p className="text-muted-foreground">a.n. {TRANSFER_ACCOUNT.holder}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Nomor rekening akan dikirim Admin via WhatsApp.</p>
            )}
          </div>
          <Button asChild variant="cta" size="lg" className="w-full">
            <Link to="/tiket" onClick={onDone}>Buka Tiket & Upload Bukti Transfer</Link>
          </Button>
          <Button asChild variant="outline" className="w-full"><Link to="/tiket" onClick={onDone}>Lihat Tiket Saya</Link></Button>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-teal-soft p-5 text-center">
          <CheckCircle2 className="mx-auto h-9 w-9 text-teal" />
          <p className="mt-2 font-display text-lg font-extrabold text-navy">Kamu di Waiting List #{booking.waitlist_position}</p>
          <p className="mt-1 text-sm text-muted-foreground">Kalau ada slot kosong, kami kabari lewat notifikasi & WhatsApp.</p>
        </div>
        <Button asChild variant="outline" className="w-full"><Link to="/tiket" onClick={onDone}>Lihat Tiket Saya</Link></Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        book(isFull ? null : method);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="reg-name">Nama Player</Label>
        <Input id="reg-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors["name"]} />
        {errors["name"] && <p className="text-xs text-destructive">{errors["name"]}</p>}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="reg-wa">No. WhatsApp</Label>
          <Input id="reg-wa" inputMode="tel" value={whatsapp} maxLength={20} placeholder="08xxxxxxxxxx" onChange={(e) => setWhatsapp(e.target.value)} aria-invalid={!!errors["whatsapp"]} />
          {errors["whatsapp"] && <p className="text-xs text-destructive">{errors["whatsapp"]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Level</Label>
          <LevelSelect value={level} onChange={setLevel} />
        </div>
      </div>

      {isFull ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-orange-soft p-4 text-sm">
            <p className="font-bold text-navy">Kuota sedang penuh</p>
            <p className="text-muted-foreground">Masuk waiting list — kamu otomatis dikabari kalau ada player yang cancel.</p>
          </div>
          <Button type="submit" variant="teal" size="lg" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />} Masuk Waiting List
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-navy">Metode Pembayaran • {formatRp(event.price)}</p>
          <div className="grid gap-2" role="radiogroup" aria-label="Metode pembayaran">
            <PayOption
              active={method === "qris"}
              onClick={() => setMethod("qris")}
              icon={<QrCode className="h-5 w-5" />}
              title="QRIS / Payment Gateway"
              desc="Konfirmasi instan otomatis. Bisa semua e-wallet & m-banking."
              badge="Instan"
            />
            <PayOption
              active={method === "transfer"}
              onClick={() => setMethod("transfer")}
              icon={<Landmark className="h-5 w-5" />}
              title="Transfer Manual"
              desc="Kirim bukti via WA Admin. Status: Menunggu Verifikasi."
            />
          </div>
          <Button type="submit" variant="cta" size="lg" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />} {method === "qris" ? "Bayar dengan QRIS" : "Daftar & Transfer Manual"}
          </Button>
        </div>
      )}
    </form>
  );
}

function PayOption({ active, onClick, icon, title, desc, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string; badge?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-colors",
        active ? "border-teal bg-teal-soft" : "border-border bg-card hover:border-teal/40",
      )}
    >
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", active ? "bg-teal text-secondary-foreground" : "bg-muted text-navy")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-bold text-navy">
          {title}
          {badge && <span className="rounded-full bg-orange px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">{badge}</span>}
        </span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}
