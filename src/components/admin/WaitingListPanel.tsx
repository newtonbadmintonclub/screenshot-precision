import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock3, Download, ListChecks, RefreshCw, Search, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/newton-client";

const PAGE_SIZE = 15;

type QueueStatus = "all" | "waiting" | "offered";
type WaitingListRow = {
  id: string;
  code: string;
  event_id: string;
  player_name: string;
  whatsapp: string;
  level: string;
  channel: string;
  amount: number;
  created_at: string;
  waitlist_position: number | null;
  waitlist_offered_at: string | null;
  waitlist_offer_expires_at: string | null;
  events: { title: string; starts_at: string; venue: string; time_slots: string | null } | null;
};

type EventOption = { id: string; title: string; starts_at: string };

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

function isOfferActive(row: WaitingListRow) {
  return !!row.waitlist_offer_expires_at && new Date(row.waitlist_offer_expires_at).getTime() > Date.now();
}

export function WaitingListPanel() {
  const [search, setSearch] = useState("");
  const [eventId, setEventId] = useState("all");
  const [queueStatus, setQueueStatus] = useState<QueueStatus>("all");
  const [page, setPage] = useState(0);

  const events = useQuery({
    queryKey: ["admin-waitlist-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,title,starts_at")
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventOption[];
    },
    staleTime: 60_000,
  });

  const queue = useQuery({
    queryKey: ["admin-waitlist", search, eventId, queueStatus, page],
    queryFn: async () => {
      let query = supabase
        .from("bookings")
        .select("id,code,event_id,player_name,whatsapp,level,channel,amount,created_at,waitlist_position,waitlist_offered_at,waitlist_offer_expires_at,events(title,starts_at,venue,time_slots)", { count: "exact" })
        .eq("status", "waiting_list");

      if (eventId !== "all") query = query.eq("event_id", eventId);
      if (queueStatus === "waiting") query = query.is("waitlist_offer_expires_at", null);
      if (queueStatus === "offered") query = query.gt("waitlist_offer_expires_at", new Date().toISOString());
      if (search.trim()) {
        const term = search.trim().replace(/[,%()]/g, " ");
        query = query.or(`player_name.ilike.%${term}%,whatsapp.ilike.%${term}%,code.ilike.%${term}%`);
      }

      const { data, error, count } = await query
        .order("waitlist_position", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: (data ?? []) as unknown as WaitingListRow[], count: count ?? 0 };
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const summary = useQuery({
    queryKey: ["admin-waitlist-summary"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const [waiting, offered, expired] = await Promise.all([
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "waiting_list"),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "waiting_list").gt("waitlist_offer_expires_at", now),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "waiting_list").lte("waitlist_offer_expires_at", now),
      ]);
      const failed = [waiting, offered, expired].find((result) => result.error);
      if (failed?.error) throw failed.error;
      return {
        total: waiting.count ?? 0,
        offered: offered.count ?? 0,
        expired: expired.count ?? 0,
      };
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const rows = queue.data?.rows ?? [];
  const pageCount = Math.max(1, Math.ceil((queue.data?.count ?? 0) / PAGE_SIZE));
  const filterDescription = useMemo(() => {
    const parts: string[] = [];
    if (queueStatus === "waiting") parts.push("Menunggu slot");
    if (queueStatus === "offered") parts.push("Slot ditawarkan");
    if (eventId !== "all") parts.push(events.data?.find((event) => event.id === eventId)?.title ?? "Sesi terpilih");
    return parts.length ? parts.join(" • ") : "Semua sesi dan status antrean";
  }, [queueStatus, eventId, events.data]);

  function updateFilters(next: { search?: string; eventId?: string; queueStatus?: QueueStatus }) {
    if (next.search !== undefined) setSearch(next.search);
    if (next.eventId !== undefined) setEventId(next.eventId);
    if (next.queueStatus !== undefined) setQueueStatus(next.queueStatus);
    setPage(0);
  }

  function exportCsv() {
    if (!rows.length) return;
    const lines = [
      ["Posisi", "Kode Booking", "Nama Pemain", "WhatsApp", "Level", "Jadwal", "Waktu Sesi", "Venue", "Status Antrean", "Tawaran Dibuat", "Batas Tawaran", "Masuk Antrean"].map(csvCell).join(";"),
      ...rows.map((row, index) => [
        row.waitlist_position ?? page * PAGE_SIZE + index + 1,
        row.code,
        row.player_name,
        row.whatsapp,
        row.level,
        row.events?.title ?? "",
        row.events?.starts_at ? dateTime(row.events.starts_at) : "",
        row.events?.venue ?? "",
        isOfferActive(row) ? "Slot ditawarkan" : "Menunggu slot",
        dateTime(row.waitlist_offered_at),
        dateTime(row.waitlist_offer_expires_at),
        dateTime(row.created_at),
      ].map(csvCell).join(";")),
    ].join("\r\n");
    const csv = String.fromCharCode(0xFEFF) + lines;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "waiting-list-newton-bc.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Ringkasan waiting list">
        <SummaryCard label="Total antrean aktif" value={summary.data?.total} icon={<ListChecks />} tint="blue" />
        <SummaryCard label="Slot sedang ditawarkan" value={summary.data?.offered} icon={<Ticket />} tint="green" />
        <SummaryCard label="Tawaran melewati batas" value={summary.data?.expired} icon={<Clock3 />} tint="orange" />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3">
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
          <div>
            <p className="text-sm font-bold text-[#142b4d]">Antrean diproses otomatis</p>
            <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-slate-600">Saat slot tersedia, sistem menawarkan slot kepada pemain berikutnya selama 30 menit dan mengirim notifikasi. Halaman ini memantau antrean; tidak mengubah urutan atau status booking secara manual.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { void Promise.all([queue.refetch(), summary.refetch()]); }} disabled={queue.isFetching || summary.isFetching} className="shrink-0 border-teal-200 bg-white">
          <RefreshCw className={`mr-2 h-4 w-4 ${queue.isFetching || summary.isFetching ? "animate-spin" : ""}`} /> Perbarui
        </Button>
      </div>

      <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="gap-4 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="font-display text-lg text-[#142b4d]">Antrean Waiting List</CardTitle>
              <CardDescription className="mt-1">Pantau posisi antrean, informasi pemain, dan masa berlaku tawaran slot.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_220px_220px]">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input value={search} onChange={(event) => updateFilters({ search: event.target.value })} placeholder="Cari kode, nama, WhatsApp..." className="min-w-0 w-full bg-transparent text-sm outline-none" />
            </label>
            <select aria-label="Filter sesi mabar" value={eventId} onChange={(event) => updateFilters({ eventId: event.target.value })} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
              <option value="all">Semua jadwal</option>
              {(events.data ?? []).map((event) => <option key={event.id} value={event.id}>{event.title} — {dateTime(event.starts_at)}</option>)}
            </select>
            <select aria-label="Filter status antrean" value={queueStatus} onChange={(event) => updateFilters({ queueStatus: event.target.value as QueueStatus })} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
              <option value="all">Semua antrean</option>
              <option value="waiting">Menunggu slot</option>
              <option value="offered">Slot ditawarkan</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>{filterDescription}</span>
            <span>{(queue.data?.count ?? 0).toLocaleString("id-ID")} pemain dalam antrean</span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {queue.isError || events.isError || summary.isError ? (
            <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Gagal memuat Waiting List: {queue.error?.message ?? events.error?.message ?? summary.error?.message}</div>
          ) : queue.isLoading || events.isLoading ? (
            <div className="space-y-3 p-5">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}</div>
          ) : rows.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Posisi</th>
                      <th className="px-4 py-3">Pemain</th>
                      <th className="px-4 py-3">Jadwal mabar</th>
                      <th className="px-4 py-3">Masuk antrean</th>
                      <th className="px-4 py-3">Status slot</th>
                      <th className="px-4 py-3 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row, index) => {
                      const activeOffer = isOfferActive(row);
                      const offerExpired = !!row.waitlist_offer_expires_at && !activeOffer;
                      return (
                        <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                          <td className="px-4 py-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 font-display text-sm font-extrabold text-[#142b4d]">{row.waitlist_position ?? page * PAGE_SIZE + index + 1}</span></td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-[#142b4d]">{row.player_name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{row.code} • {row.whatsapp}</p>
                            <p className="text-xs text-slate-400">{row.level} • {row.channel}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="max-w-[240px] truncate font-semibold text-slate-700">{row.events?.title ?? "Jadwal tidak tersedia"}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{dateTime(row.events?.starts_at)} • {row.events?.venue ?? "—"}</p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{dateTime(row.created_at)}</td>
                          <td className="px-4 py-3">
                            {activeOffer ? <><Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Slot ditawarkan</Badge><p className="mt-1 text-[11px] font-semibold text-emerald-700">Batas {dateTime(row.waitlist_offer_expires_at)}</p></> :
                              offerExpired ? <><Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">Menunggu pemrosesan</Badge><p className="mt-1 text-[11px] text-slate-500">Tawaran telah melewati batas waktu</p></> :
                              <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">Menunggu slot</Badge>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[#142b4d]">{money(row.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                <span>Menampilkan {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, queue.data?.count ?? 0)} dari {queue.data?.count ?? 0} pemain</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Sebelumnya</Button>
                  <span>Halaman {page + 1} / {pageCount}</span>
                  <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>Berikutnya</Button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center">
              <ListChecks className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 font-semibold text-slate-700">Belum ada pemain dalam antrean</p>
              <p className="mt-1 text-sm text-slate-500">Booking dengan status Waiting List akan muncul di sini secara otomatis.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, icon, tint }: { label: string; value: number | undefined; icon: React.ReactNode; tint: string }) {
  const styles: Record<string, string> = {
    blue: "bg-sky-50 text-sky-600",
    green: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
  };
  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardContent className="flex items-start justify-between p-4">
        <div>
          <p className="text-xs font-semibold text-slate-600">{label}</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-[#142b4d]">{value === undefined ? "—" : value.toLocaleString("id-ID")}</p>
          <p className="mt-1 text-[11px] text-slate-500">Data langsung dari Supabase</p>
        </div>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${styles[tint]}`}>{icon}</span>
      </CardContent>
    </Card>
  );
}
