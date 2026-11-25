import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, CheckCircle2, Clock3, Download, Eye, ListChecks, Search, Ticket, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/newton-client";

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [
  { value: "all", label: "Semua status" },
  { value: "awaiting_payment", label: "Menunggu pembayaran" },
  { value: "pending_verification", label: "Verifikasi transfer" },
  { value: "confirmed", label: "Terkonfirmasi" },
  { value: "waiting_list", label: "Waiting list" },
  { value: "cancel_requested", label: "Pengajuan pembatalan" },
  { value: "swap_requested", label: "Pengajuan oper slot" },
  { value: "cancelled", label: "Dibatalkan" },
] as const;

type BookingStatus = (typeof STATUS_OPTIONS)[number]["value"];
type BookingRow = {
  id: string;
  code: string;
  event_id: string;
  user_id: string;
  player_name: string;
  whatsapp: string;
  level: string;
  channel: string;
  payment_method: string | null;
  status: Exclude<BookingStatus, "all">;
  waitlist_position: number | null;
  amount: number;
  created_at: string;
  updated_at: string;
  payment_expires_at: string | null;
  paid_at: string | null;
  payment_proof_path: string | null;
  payment_proof_uploaded_at: string | null;
  events: { title: string; starts_at: string; venue: string; time_slots: string } | null;
  booking_requests: {
    id: string;
    request_type: string;
    reason: string | null;
    replacement_name: string | null;
    replacement_whatsapp: string | null;
    status: string;
    created_at: string;
    previous_booking_status?: string | null;
  }[];
};

type EventOption = { id: string; title: string; starts_at: string };

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Menunggu pembayaran",
  pending_verification: "Verifikasi transfer",
  confirmed: "Terkonfirmasi",
  waiting_list: "Waiting list",
  cancel_requested: "Pengajuan pembatalan",
  swap_requested: "Pengajuan oper slot",
  cancelled: "Dibatalkan",
};

function dateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}
function money(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}
function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}
function statusStyle(status: string) {
  if (status === "confirmed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "awaiting_payment" || status === "pending_verification") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "waiting_list") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status.includes("requested")) return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

export function BookingPanel() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<BookingStatus>("all");
  const [eventId, setEventId] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<BookingRow | null>(null);

  const events = useQuery({
    queryKey: ["admin-booking-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("id,title,starts_at").order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventOption[];
    },
    staleTime: 60_000,
  });

  const bookings = useQuery({
    queryKey: ["admin-bookings", search, status, eventId, page],
    queryFn: async () => {
      let query = supabase
        .from("bookings")
        .select("id,code,event_id,user_id,player_name,whatsapp,level,channel,payment_method,status,waitlist_position,amount,created_at,updated_at,payment_expires_at,paid_at,payment_proof_path,payment_proof_uploaded_at,events(title,starts_at,venue,time_slots),booking_requests(id,request_type,reason,replacement_name,replacement_whatsapp,status,created_at)", { count: "exact" });
      if (status !== "all") query = query.eq("status", status);
      if (eventId !== "all") query = query.eq("event_id", eventId);
      if (search.trim()) {
        const term = search.trim().replace(/[,%()]/g, " ");
        query = query.or(`player_name.ilike.%${term}%,whatsapp.ilike.%${term}%,code.ilike.%${term}%`);
      }
      const { data, error, count } = await query.order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: (data ?? []) as unknown as BookingRow[], count: count ?? 0 };
    },
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  const summary = useQuery({
    queryKey: ["admin-booking-summary"],
    queryFn: async () => {
      const statuses = ["confirmed", "awaiting_payment", "pending_verification", "waiting_list"] as const;
      const results = await Promise.all(statuses.map((value) =>
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", value)
      ));
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      return Object.fromEntries(statuses.map((value, index) => [value, results[index].count ?? 0])) as Record<(typeof statuses)[number], number>;
    },
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  const queryClient = useQueryClient();
  const reviewMutation = useMutation({
    mutationFn: async (input: { bookingId: string; action: string; requestId?: string; reason?: string }) => {
      const { data, error } = await supabase.rpc("admin_review_booking", {
        _booking_id: input.bookingId,
        _action: input.action,
        _request_id: input.requestId ?? null,
        _reason: input.reason ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-booking-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
      ]);
      setSelected(null);
    },
  });

  const proofPreview = useQuery({
    queryKey: ["admin-booking-proof", selected?.id, selected?.payment_proof_path],
    enabled: !!selected?.payment_proof_path,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("booking-payment-proofs").createSignedUrl(selected!.payment_proof_path!, 300);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  const actionHistory = useQuery({
    queryKey: ["admin-booking-actions", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_admin_actions")
        .select("id,action,reason,created_at")
        .eq("booking_id", selected!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  function runReview(action: string, requestId?: string) {
    const messages: Record<string, string> = {
      approve_transfer: "Konfirmasi bahwa bukti transfer sudah diperiksa dan nominal sesuai. Booking akan diaktifkan.",
      reject_transfer: "Tolak verifikasi transfer ini? Booking akan dibatalkan.",
      approve_cancel: "Setujui pembatalan booking ini? Ini tidak memproses refund dana secara otomatis.",
      reject_cancel: "Tolak pembatalan dan kembalikan tiket ke status sebelumnya?",
      approve_swap: "Setujui oper slot dan ganti nama serta WhatsApp peserta pada tiket?",
      reject_swap: "Tolak oper slot dan kembalikan tiket ke status sebelumnya?",
    };
    if (!window.confirm(messages[action] ?? "Lanjutkan tindakan ini?")) return;
    const reason = action.startsWith("reject_")
      ? window.prompt("Catatan penolakan (wajib):")?.trim()
      : window.prompt("Catatan Admin (opsional):")?.trim() ?? "";
    if (action.startsWith("reject_") && !reason) return;
    reviewMutation.mutate({ bookingId: selected!.id, action, requestId, reason });
  }

  const pageCount = Math.max(1, Math.ceil((bookings.data?.count ?? 0) / PAGE_SIZE));
  const visibleRows = bookings.data?.rows ?? [];
  const filteredDescription = useMemo(() => {
    const pieces = [];
    if (status !== "all") pieces.push(STATUS_LABEL[status] ?? status);
    if (eventId !== "all") pieces.push(events.data?.find((item) => item.id === eventId)?.title ?? "Sesi terpilih");
    return pieces.length ? pieces.join(" • ") : "Semua sesi dan status booking";
  }, [status, eventId, events.data]);

  function updateFilters(next: { status?: BookingStatus; eventId?: string; search?: string }) {
    if (next.status !== undefined) setStatus(next.status);
    if (next.eventId !== undefined) setEventId(next.eventId);
    if (next.search !== undefined) setSearch(next.search);
    setPage(0);
    setSelected(null);
  }

  function exportCsv() {
    const rows = visibleRows;
    if (!rows.length) return;
    const csv = [
      ["Kode Booking", "Nama Pemain", "WhatsApp", "Level", "Jadwal", "Tanggal Sesi", "Status", "Metode Bayar", "Channel", "Nominal", "Dibuat"].map(csvCell).join(","),
      ...rows.map((item) => [
        item.code, item.player_name, item.whatsapp, item.level, item.events?.title ?? "",
        item.events?.starts_at ? dateTime(item.events.starts_at) : "",
        STATUS_LABEL[item.status] ?? item.status, item.payment_method ?? "", item.channel, item.amount, dateTime(item.created_at),
      ].map(csvCell).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob(["\\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "booking-newton-bc.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ringkasan booking">
        <SummaryCard label="Terkonfirmasi" value={summary.data?.confirmed} icon={<CheckCircle2 />} tint="green" />
        <SummaryCard label="Menunggu pembayaran" value={summary.data?.awaiting_payment} icon={<Clock3 />} tint="orange" />
        <SummaryCard label="Verifikasi transfer" value={summary.data?.pending_verification} icon={<Ticket />} tint="blue" />
        <SummaryCard label="Waiting list" value={summary.data?.waiting_list} icon={<ListChecks />} tint="purple" />
      </section>

      <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="gap-4 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="font-display text-lg text-[#142b4d]">Semua Booking</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Pendaftaran sesi mabar, data pembayaran, dan permintaan perubahan booking.</p>
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!visibleRows.length}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_190px_220px]">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input value={search} onChange={(event) => updateFilters({ search: event.target.value })} placeholder="Cari kode, nama, WhatsApp..." className="min-w-0 w-full bg-transparent text-sm outline-none" />
            </label>
            <select aria-label="Filter status booking" value={status} onChange={(event) => updateFilters({ status: event.target.value as BookingStatus })} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
              {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select aria-label="Filter jadwal mabar" value={eventId} onChange={(event) => updateFilters({ eventId: event.target.value })} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
              <option value="all">Semua jadwal</option>
              {(events.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.title} — {dateTime(item.starts_at)}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{filteredDescription}</span>
            <span>{(bookings.data?.count ?? 0).toLocaleString("id-ID")} booking</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {bookings.isError || events.isError || summary.isError ? (
            <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Gagal memuat data Booking: {bookings.error?.message ?? events.error?.message ?? summary.error?.message}</div>
          ) : bookings.isLoading || events.isLoading ? (
            <div className="space-y-3 p-5">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}</div>
          ) : visibleRows.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Booking / Pemain</th>
                      <th className="px-4 py-3">Jadwal</th>
                      <th className="px-4 py-3">Pembayaran</th>
                      <th className="px-4 py-3">Nominal</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleRows.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <p className="font-bold text-[#142b4d]">{item.code}</p>
                          <p className="mt-0.5 text-sm font-semibold text-slate-700">{item.player_name}</p>
                          <p className="text-xs text-slate-500">{item.whatsapp} • {item.level}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-[220px] truncate font-semibold text-slate-700">{item.events?.title ?? "Jadwal tidak tersedia"}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{dateTime(item.events?.starts_at)} • {item.events?.venue ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold capitalize text-slate-700">{item.payment_method ?? "Belum dipilih"}</p>
                          <p className="mt-0.5 text-xs text-slate-500">Via {item.channel}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-bold text-[#142b4d]">{money(item.amount)}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className={statusStyle(item.status)}>{STATUS_LABEL[item.status] ?? item.status}</Badge></td>
                        <td className="px-4 py-3 text-right"><Button variant="ghost" size="icon" aria-label={`Lihat booking ${item.code}`} onClick={() => setSelected(item)}><Eye className="h-4 w-4" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                <span>Menampilkan {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, bookings.data?.count ?? 0)} dari {bookings.data?.count ?? 0} booking</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Sebelumnya</Button>
                  <span>Halaman {page + 1} / {pageCount}</span>
                  <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>Berikutnya</Button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center">
              <Ticket className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 font-semibold text-slate-700">Belum ada booking ditemukan</p>
              <p className="mt-1 text-sm text-slate-500">Coba ubah kata pencarian atau filter yang digunakan.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="Detail booking" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <div className="mx-auto my-8 max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-widest text-teal-700">Booking Detail</p><h2 className="mt-1 text-xl font-extrabold text-[#142b4d]">{selected.code}</h2><p className="mt-1 text-sm text-slate-500">Dibuat {dateTime(selected.created_at)}</p></div>
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Tutup detail"><X /></Button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2"><Badge variant="outline" className={statusStyle(selected.status)}>{STATUS_LABEL[selected.status] ?? selected.status}</Badge><Badge variant="outline">{selected.channel}</Badge></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Detail label="Nama pemain" value={selected.player_name} />
              <Detail label="WhatsApp" value={selected.whatsapp} />
              <Detail label="Level" value={selected.level} />
              <Detail label="Jadwal" value={selected.events?.title ?? "—"} />
              <Detail label="Waktu sesi" value={dateTime(selected.events?.starts_at)} />
              <Detail label="Venue" value={selected.events?.venue ?? "—"} />
              <Detail label="Metode pembayaran" value={selected.payment_method ?? "Belum dipilih"} />
              <Detail label="Nominal" value={money(selected.amount)} />
              <Detail label="Waktu pembayaran" value={dateTime(selected.paid_at)} />
              <Detail label="Batas pembayaran" value={dateTime(selected.payment_expires_at)} />
              <Detail label="Posisi waiting list" value={selected.waitlist_position?.toString() ?? "—"} />
              <Detail label="Update terakhir" value={dateTime(selected.updated_at)} />
            </div>
            {selected.status === "pending_verification" && selected.payment_method === "transfer" && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-bold text-amber-900">Verifikasi transfer manual</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800">Periksa file bukti pembayaran dan pastikan nama pengirim, rekening tujuan, nominal, serta waktu transfer sesuai sebelum menyetujui.</p>
                {selected.payment_proof_path ? (
                  proofPreview.isLoading ? <p className="mt-3 text-xs text-slate-500">Menyiapkan akses aman ke bukti…</p> :
                  proofPreview.data ? <a href={proofPreview.data} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-[#142b4d] hover:bg-amber-100"><Eye className="h-4 w-4" /> Lihat Bukti Transfer</a> :
                  <p className="mt-3 text-xs text-red-700">Bukti tidak dapat dibuka: {proofPreview.error?.message ?? "Coba muat ulang."}</p>
                ) : <p className="mt-3 rounded-lg bg-white p-3 text-xs text-amber-800">Pemain belum mengunggah bukti transfer. Verifikasi belum dapat disetujui.</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" disabled={reviewMutation.isPending || !selected.payment_proof_path || proofPreview.isError} onClick={() => runReview("approve_transfer")} className="bg-emerald-600 text-white hover:bg-emerald-700">Verifikasi & Aktifkan Tiket</Button>
                  <Button size="sm" variant="outline" disabled={reviewMutation.isPending} onClick={() => runReview("reject_transfer")} className="border-red-200 text-red-700 hover:bg-red-50">Tolak Pembayaran</Button>
                </div>
              </div>
            )}
            {reviewMutation.isError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{reviewMutation.error.message}</p>}
            <div className="mt-5 rounded-xl border border-slate-100 p-4">
              <h3 className="text-sm font-bold text-[#142b4d]">Permintaan perubahan booking</h3>
              {selected.booking_requests?.length ? selected.booking_requests.map((request) => (
                <div key={request.id} className="mt-3 border-t border-slate-100 pt-3 first:mt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-700">{request.request_type === "cancel" ? "Pembatalan" : "Oper slot"} • {dateTime(request.created_at)}</p><Badge variant="outline">{request.status}</Badge></div>
                  <p className="mt-1 text-sm text-slate-600">{request.reason || "Tidak ada alasan yang dicantumkan."}</p>
                  {request.replacement_name && <p className="mt-1 text-xs text-slate-500">Pengganti: {request.replacement_name} • {request.replacement_whatsapp}</p>}
                  {request.status === "pending" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {request.request_type === "cancel" ? (
                        <>
                          <Button size="sm" disabled={reviewMutation.isPending} onClick={() => runReview("approve_cancel", request.id)} className="bg-emerald-600 text-white hover:bg-emerald-700">Setujui Cancel</Button>
                          <Button size="sm" variant="outline" disabled={reviewMutation.isPending} onClick={() => runReview("reject_cancel", request.id)}>Tolak</Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" disabled={reviewMutation.isPending} onClick={() => runReview("approve_swap", request.id)} className="bg-emerald-600 text-white hover:bg-emerald-700">Setujui Oper Slot</Button>
                          <Button size="sm" variant="outline" disabled={reviewMutation.isPending} onClick={() => runReview("reject_swap", request.id)}>Tolak</Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )) : <p className="mt-2 text-sm text-slate-500">Belum ada permintaan perubahan.</p>}
            </div>
            <div className="mt-5 rounded-xl border border-slate-100 p-4">
              <h3 className="text-sm font-bold text-[#142b4d]">Riwayat tindakan Admin</h3>
              {actionHistory.isLoading ? <p className="mt-2 text-sm text-slate-500">Memuat riwayat…</p> : actionHistory.data?.length ? actionHistory.data.map((item) => (
                <div key={item.id} className="mt-2 border-t border-slate-100 pt-2 first:mt-1">
                  <p className="text-sm font-semibold text-slate-700">{item.action.replaceAll("_", " ")}</p>
                  <p className="text-xs text-slate-500">{dateTime(item.created_at)}{item.reason ? " • " + item.reason : ""}</p>
                </div>
              )) : <p className="mt-2 text-sm text-slate-500">Belum ada tindakan Admin untuk booking ini.</p>}
              {actionHistory.isError && <p className="mt-2 text-xs text-red-600">Riwayat tindakan tidak dapat dimuat.</p>}
            </div>
            <div className="mt-5 flex justify-end"><Button variant="outline" onClick={() => setSelected(null)}>Tutup</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, tint }: { label: string; value?: number; icon: React.ReactNode; tint: string }) {
  const styles: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-600", orange: "bg-orange-50 text-orange-600",
    blue: "bg-sky-50 text-sky-600", purple: "bg-purple-50 text-purple-600",
  };
  return <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardContent className="flex items-start justify-between p-4"><div><p className="text-xs font-semibold text-slate-600">{label}</p><p className="mt-1 font-display text-3xl font-extrabold text-[#142b4d]">{value === undefined ? "—" : value.toLocaleString("id-ID")}</p><p className="mt-1 text-[11px] text-slate-500">Data real-time dari Supabase</p></div><span className={`grid h-9 w-9 place-items-center rounded-xl ${styles[tint]}`}>{icon}</span></CardContent></Card>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>;
}
