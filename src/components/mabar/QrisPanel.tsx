import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "react-qr-code";
import { CheckCircle2, Loader2, QrCode, TimerOff } from "lucide-react";
import { startQrisPayment } from "@/lib/payments.functions";
import { formatRp } from "@/lib/brand";
import { Button } from "@/components/ui/button";

function useCountdown(target?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!target) return null;
  const ms = Math.max(0, new Date(target).getTime() - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { ms, label: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` };
}

export function QrisPanel({ bookingId, onSwitchToTransfer, switching }: { bookingId: string; onSwitchToTransfer?: () => void; switching?: boolean }) {
  const start = useServerFn(startQrisPayment);
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["qris", bookingId],
    queryFn: () => start({ data: { bookingId } }),
    refetchInterval: (query) => (query.state.data?.state === "awaiting" ? 4000 : false),
    retry: false,
  });
  const result = q.data;
  const countdown = useCountdown(result && result.state === "awaiting" ? result.expiresAt : undefined);

  useEffect(() => {
    if (q.data?.state === "confirmed") {
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  }, [q.data?.state, queryClient]);

  if (q.isLoading) {
    return (
      <div className="grid place-items-center gap-3 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-teal" /> Menyiapkan QRIS…
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="space-y-3 rounded-xl bg-destructive/5 p-4 text-sm">
        <p className="font-semibold text-destructive">QRIS gagal dibuat</p>
        <p className="text-muted-foreground">{(q.error as Error).message}</p>
        <Button variant="outline" onClick={() => q.refetch()}>Coba lagi</Button>
      </div>
    );
  }

  const data = q.data;
  if (!data) return null;

  if (data.state === "confirmed") {
    return (
      <div className="space-y-2 rounded-2xl bg-success-soft p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <p className="font-display text-lg font-extrabold text-navy">Pembayaran diterima!</p>
        <p className="text-sm text-muted-foreground">E-Ticket kamu sudah aktif. Cek di menu Tiket Saya.</p>
      </div>
    );
  }

  if (data.state === "expired" || (countdown && countdown.ms === 0)) {
    return (
      <div className="space-y-2 rounded-2xl bg-muted p-6 text-center">
        <TimerOff className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="font-bold text-navy">Waktu pembayaran habis</p>
        <p className="text-sm text-muted-foreground">Slot dilepas. Silakan daftar ulang dari Jadwal Mabar.</p>
      </div>
    );
  }

  if (data.state === "unavailable") {
    return (
      <div className="space-y-3 rounded-2xl border border-orange/30 bg-orange-soft p-5 text-sm">
        <p className="flex items-center gap-2 font-bold text-navy">
          <QrCode className="h-4 w-4 text-orange" /> QRIS belum aktif
        </p>
        <p className="text-muted-foreground">{data.message}</p>
        {onSwitchToTransfer && (
          <Button variant="default" onClick={onSwitchToTransfer} disabled={switching}>
            {switching && <Loader2 className="animate-spin" />} Ganti ke Transfer Manual
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto w-fit rounded-2xl border-4 border-navy bg-card p-4 shadow-card">
        <QRCode value={data.qrString} size={196} />
      </div>
      <div>
        <p className="eyebrow text-teal">Scan QRIS • {data.code}</p>
        <p className="font-display text-2xl font-extrabold text-navy">{formatRp(data.amount)}</p>
        {countdown && (
          <p className="text-sm text-muted-foreground">
            Bayar dalam <span className="font-bold text-orange">{countdown.label}</span> — slot kamu ditahan.
          </p>
        )}
      </div>
      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Menunggu konfirmasi otomatis dari bank…
      </p>
    </div>
  );
}
