import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Eye, RefreshCw, Wallet, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/newton-client";

type RefundStatus = "pending_review" | "approved" | "processing" | "completed" | "rejected";
type RefundRow = {
  id: string;
  booking_id: string;
  user_id: string;
  amount: number;
  payment_method: "qris" | "transfer";
  status: RefundStatus;
  reason: string | null;
  admin_note: string | null;
  external_reference: string | null;
  requested_at: string;
  reviewed_at: string | null;
  processed_at: string | null;
  completed_at: string | null;
  bookings: { code: string; player_name: string; whatsapp: string; events: { title: string; starts_at: string } | null } | null;
};
type RefundAction = { id: string; action: string; reason: string | null; external_reference: string | null; created_at: string };

const FILTERS = [
  { value: "all", label: "Semua status" },
  { value: "pending_review", label: "Perlu ditinjau" },
  { value: "approved", label: "Disetujui" },
  { value: "processing", label: "Diproses" },
  { value: "completed", label: "Selesai" },
  { value: "rejected", label: "Ditolak" },
] as const;
const LABELS: Record<RefundStatus, string> = {
  pending_review: "Perlu ditinjau",
  approved: "Disetujui",
  processing: "Sedang diproses",
  completed: "Selesai",
  rejected: "Ditolak",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}
function statusClass(status: RefundStatus) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "pending_review") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "processing") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "approved") return "border-teal-200 bg-teal-50 text-teal-700";
  return "border-red-200 bg-red-50 text-red-700";
}

export function RefundPanel() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RefundRow | null>(null);
  const queryClient = useQueryClient();

  const refunds = useQuery({
    queryKey: ["admin-refunds", filter, search],
    queryFn: async () => {
      let query = supabase
        .from("refund_requests")
        .select("id,booking_id,user_id,amount,payment_method,status,reason,admin_note,external_reference,requested_at,reviewed_at,processed_at,completed_at,bookings(code,player_name,whatsapp,events(title,starts_at))")
        .order("requested_at", { ascending: false });
      if (filter !== "all") query = query.eq("status", filter);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as unknown as RefundRow[];
      if (!search.trim()) return rows;
      const term = search.trim().toLocaleLowerCase("id-ID");
      return rows.filter((row) =>
        [row.bookings?.code, row.bookings?.player_name, row.bookings?.whatsapp]
          .some((value) => value?.toLocaleLowerCase("id-ID").includes(term)),
      );
    },
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  const history = useQuery({
    queryKey: ["admin-refund-history", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("refund_admin_actions")
        .select("id,action,reason,external_reference,created_at")
        .eq("refund_id", selected!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RefundAction[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: { refundId: string; status: string; reason?: string; reference?: string }) => {
      const { data, error } = await supabase.rpc("admin_update_refund_status", {
        _refund_id: input.refundId,
        _status: input.status,
        _reason: input.reason ?? null,
        _external_reference: input.reference ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-refunds"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-refund-history"] }),
      ]);
      setSelected(null);
    },
  });

  const summary = useMemo(() => {
    const rows = refunds.data ?? [];
    return {
      total: rows.length,
      pending: rows.filter((row) => row.status === "pending_review").length,
      processing: rows.filter((row) => row.status === "approved" || row.status === "processing").length,
      completed: rows.filter((row) => row.status === "completed").length,
      amount: rows.filter((row) => row.status === "completed").reduce((sum, row) => sum + row.amount, 0),
    };
  }, [refunds.data]);

  function runAction(status: "approved" | "processing" | "completed" | "rejected") {
    if (!selected) return;
    const prompts: Record<typeof status, string> = {
      approved: "Setujui permintaan refund ini? Persetujuan belum berarti dana sudah dikembalikan.",
      processing: "Tandai refund mulai diproses. Pastikan Admin akan melakukan pengembalian dana di kanal pembayaran asal.",
      completed: "Konfirmasi bahwa dana benar-benar sudah dikembalikan kepada pemain. Jangan tandai selesai sebelum transaksi pengembalian berhasil.",
      rejected: "Tolak permintaan refund ini?",
    };
    if (!window.confirm(prompts[status])) return;
    const reason = window.prompt(
      status === "rejected" ? "Alasan penolakan (wajib):" : status === "completed" ? "Catatan bukti pengembalian dana (wajib):" : "Catatan Admin (opsional):",
    )?.trim() ?? "";
    if ((status === "rejected" || status === "completed") && !reason) return;
    const reference = status === "processing" || status === "completed"
      ? window.prompt("Referensi transaksi refund (opsional):")?.trim() ?? ""
      : "";
    updateMutation.mutate({ refundId: selected.id, status, reason, reference });
  }

  const rows = refunds.data ?? [];
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-relaxed text-sky-900">
        <p className="font-bold">Penting: persetujuan pembatalan berbeda dari pengembalian dana.</p>
        <p className="mt-1 text-sky-800">Refund di sini dicatat dan dilacak secara manual. Sistem tidak mengirim dana otomatis ke QRIS atau rekening pemain. Tandai selesai hanya setelah pengembalian benar-benar dilakukan dan diverifikasi.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ringkasan refund">
        <Metric label="Perlu ditinjau" value={summary.pending} icon={<Clock3 />} tint="amber" />
        <Metric label="Disetujui / diproses" value={summary.processing} icon={<RefreshCw />} tint="blue" />
        <Metric label="Refund selesai" value={summary.completed} icon={<CheckCircle2 />} tint="green" />
        <Metric label="Total dana dikembalikan" value={formatMoney(summary.amount)} icon={<Wallet />} tint="teal" />
      </section>

      <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="gap-4 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle className="font-display text-lg text-[#142b4d]">Manajemen Refund</CardTitle><p className="mt-1 text-sm text-slate-500">Daftar refund yang muncul setelah pembatalan booking yang sudah dibayar disetujui.</p></div>
            <Button variant="outline" size="sm" onClick={() => void refunds.refetch()} disabled={refunds.isFetching}><RefreshCw className={refunds.isFetching ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} /> Perbarui</Button>
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_220px]">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari kode booking, nama, WhatsApp..." className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500" />
            <select aria-label="Filter status refund" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
              {FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {refunds.isError ? <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Gagal memuat data refund: {refunds.error.message}</div>
          : refunds.isLoading ? <div className="space-y-3 p-5">{[0,1,2].map((n) => <div key={n} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}</div>
          : rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Booking / Pemain</th><th className="px-4 py-3">Metode</th><th className="px-4 py-3">Nominal</th><th className="px-4 py-3">Diajukan</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Detail</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3"><p className="font-bold text-[#142b4d]">{row.bookings?.code ?? "Booking tidak tersedia"}</p><p className="mt-0.5 font-semibold text-slate-700">{row.bookings?.player_name ?? "—"}</p><p className="text-xs text-slate-500">{row.bookings?.whatsapp ?? "—"}</p></td>
                      <td className="px-4 py-3 capitalize text-slate-600">{row.payment_method}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-bold text-[#142b4d]">{formatMoney(row.amount)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDate(row.requested_at)}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className={statusClass(row.status)}>{LABELS[row.status]}</Badge></td>
                      <td className="px-4 py-3 text-right"><Button variant="ghost" size="icon" aria-label={`Detail refund ${row.bookings?.code ?? ""}`} onClick={() => setSelected(row)}><Eye className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="p-12 text-center"><Wallet className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">Belum ada data refund</p><p className="mt-1 text-sm text-slate-500">Refund akan tercatat otomatis setelah pembatalan booking yang sudah dibayar disetujui Admin.</p></div>}
        </CardContent>
      </Card>

      {selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="Detail refund" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <div className="mx-auto my-8 max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-teal-700">Refund Detail</p><h2 className="mt-1 text-xl font-extrabold text-[#142b4d]">{selected.bookings?.code ?? "Booking"}</h2><p className="mt-1 text-sm text-slate-500">{selected.bookings?.player_name} • {formatDate(selected.requested_at)}</p></div><Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Tutup detail"><XCircle /></Button></div>
            <div className="mt-4 flex flex-wrap gap-2"><Badge variant="outline" className={statusClass(selected.status)}>{LABELS[selected.status]}</Badge><Badge variant="outline" className="capitalize">{selected.payment_method}</Badge></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Detail label="Nominal refund" value={formatMoney(selected.amount)} />
              <Detail label="Jadwal" value={selected.bookings?.events?.title ?? "—"} />
              <Detail label="Waktu sesi" value={formatDate(selected.bookings?.events?.starts_at)} />
              <Detail label="Alasan pembatalan" value={selected.reason ?? "Tidak dicantumkan"} />
              <Detail label="Referensi refund" value={selected.external_reference ?? "Belum dicatat"} />
              <Detail label="Catatan Admin" value={selected.admin_note ?? "—"} />
            </div>
            {selected.status !== "completed" && selected.status !== "rejected" && (
              <div className="mt-5 rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-bold text-[#142b4d]">Tindakan berikutnya</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{selected.status === "pending_review" ? "Tinjau kelayakan dan nominal refund." : selected.status === "approved" ? "Lakukan pengembalian dana melalui kanal pembayaran yang sesuai, lalu tandai mulai diproses." : "Setelah dana benar-benar diterima pemain, catat bukti dan tandai selesai."}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.status === "pending_review" && <><Button size="sm" disabled={updateMutation.isPending} onClick={() => runAction("approved")} className="bg-emerald-600 text-white hover:bg-emerald-700">Setujui Refund</Button><Button size="sm" variant="outline" disabled={updateMutation.isPending} onClick={() => runAction("rejected")} className="border-red-200 text-red-700">Tolak</Button></>}
                  {selected.status === "approved" && <><Button size="sm" disabled={updateMutation.isPending} onClick={() => runAction("processing")} className="bg-sky-600 text-white hover:bg-sky-700">Mulai Proses Refund</Button><Button size="sm" variant="outline" disabled={updateMutation.isPending} onClick={() => runAction("rejected")} className="border-red-200 text-red-700">Tolak</Button></>}
                  {selected.status === "processing" && <Button size="sm" disabled={updateMutation.isPending} onClick={() => runAction("completed")} className="bg-emerald-600 text-white hover:bg-emerald-700">Dana Sudah Dikembalikan</Button>}
                </div>
              </div>
            )}
            {updateMutation.isError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{updateMutation.error.message}</p>}
            <div className="mt-5 rounded-xl border border-slate-100 p-4"><h3 className="text-sm font-bold text-[#142b4d]">Audit trail refund</h3>{history.isLoading ? <p className="mt-2 text-sm text-slate-500">Memuat riwayat…</p> : history.data?.length ? history.data.map((item) => <div key={item.id} className="mt-2 border-t border-slate-100 pt-2 first:mt-1"><p className="text-sm font-semibold capitalize text-slate-700">{item.action.replaceAll("_", " ")}</p><p className="text-xs text-slate-500">{formatDate(item.created_at)}{item.reason ? ` • ${item.reason}` : ""}{item.external_reference ? ` • Ref: ${item.external_reference}` : ""}</p></div>) : <p className="mt-2 text-sm text-slate-500">Belum ada tindakan refund.</p>}{history.isError && <p className="mt-2 text-xs text-red-600">Riwayat tidak dapat dimuat.</p>}</div>
            <div className="mt-5 flex justify-end"><Button variant="outline" onClick={() => setSelected(null)}>Tutup</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, icon, tint }: { label: string; value: number | string; icon: React.ReactNode; tint: string }) {
  const styles: Record<string, string> = { amber: "bg-amber-50 text-amber-600", blue: "bg-sky-50 text-sky-600", green: "bg-emerald-50 text-emerald-600", teal: "bg-teal-50 text-teal-600" };
  return <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardContent className="flex items-start justify-between p-4"><div><p className="text-xs font-semibold text-slate-600">{label}</p><p className="mt-1 font-display text-2xl font-extrabold text-[#142b4d]">{typeof value === "number" ? value.toLocaleString("id-ID") : value}</p><p className="mt-1 text-[11px] text-slate-500">Data dari Supabase</p></div><span className={`grid h-9 w-9 place-items-center rounded-xl ${styles[tint]}`}>{icon}</span></CardContent></Card>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>;
}
