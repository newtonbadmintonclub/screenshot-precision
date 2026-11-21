import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, ArrowLeft, CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Clock3, Download, Eye, MapPin, Pencil, Phone, Plus, Search,
  SlidersHorizontal, Trophy, Users, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 10;
const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCE", "GUEST"] as const;
type Profile = {
  id: string;
  full_name: string;
  whatsapp: string;
  level: string;
  created_at: string;
  updated_at: string;
};
type BookingActivity = {
  user_id: string;
  player_name: string;
  level: string;
  status: string;
  created_at: string;
  events: { starts_at: string; title: string; venue: string } | null;
};

function dateLabel(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "NB";
}
function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function MembershipPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ full_name: "", whatsapp: "", level: "BEGINNER" });
  const [showAddInfo, setShowAddInfo] = useState(false);

  const profiles = useQuery({
    queryKey: ["admin-membership-profiles", search, level, page],
    queryFn: async () => {
      let query = supabase.from("profiles").select("id,full_name,whatsapp,level,created_at,updated_at", { count: "exact" });
      if (search.trim()) {
        const term = search.trim().replace(/[,%()]/g, " ");
        query = query.or(`full_name.ilike.%${term}%,whatsapp.ilike.%${term}%`);
      }
      if (level !== "all") query = query.eq("level", level);
      const { data, error, count } = await query.order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: (data ?? []) as Profile[], count: count ?? 0 };
    },
  });

  const activity = useQuery({
    queryKey: ["admin-membership-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("user_id,player_name,level,status,created_at,events(starts_at,title,venue)")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as BookingActivity[];
    },
    staleTime: 30_000,
  });

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Pilih pemain terlebih dahulu.");
      const { error } = await supabase.from("profiles").update({
        full_name: draft.full_name.trim(),
        whatsapp: draft.whatsapp.trim(),
        level: draft.level,
      }).eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-membership-profiles"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-membership-activity"] });
      setSelected(null);
      setEditing(false);
    },
  });

  const allActivity = activity.data ?? [];
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const activeIds = new Set(allActivity.filter((item) => item.status === "confirmed" && new Date(item.created_at) >= ninetyDaysAgo).map((item) => item.user_id));
  const newThisMonth = allActivity.filter((item) => new Date(item.created_at) >= monthStart).reduce((ids, item) => ids.add(item.user_id), new Set<string>()).size;
  const byUser = useMemo(() => {
    const map = new Map<string, BookingActivity[]>();
    for (const item of allActivity) {
      const entries = map.get(item.user_id) ?? [];
      entries.push(item);
      map.set(item.user_id, entries);
    }
    return map;
  }, [allActivity]);
  const totalCount = profiles.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function openProfile(profile: Profile, edit = false) {
    setSelected(profile);
    setDraft({ full_name: profile.full_name, whatsapp: profile.whatsapp, level: profile.level || "BEGINNER" });
    setEditing(edit);
  }
  function exportCsv() {
    const rows = profiles.data?.rows ?? [];
    const csv = [
      ["ID Pemain", "Nama", "WhatsApp", "Level", "Total Mabar", "Terakhir Mabar", "Status"].map(csvCell).join(","),
      ...rows.map((profile) => {
        const bookings = byUser.get(profile.id) ?? [];
        const confirmed = bookings.filter((item) => item.status === "confirmed");
        const last = confirmed[0]?.created_at;
        const status = last && new Date(last) >= ninetyDaysAgo ? "Aktif" : "Pasif";
        return [`NWT-${profile.id.slice(0, 6).toUpperCase()}`, profile.full_name, profile.whatsapp, profile.level, confirmed.length, dateLabel(last), status].map(csvCell).join(",");
      }),
    ].join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "database-pemain-newton-bc.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!profiles.data?.rows.length}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
        <Button size="sm" onClick={() => setShowAddInfo(true)} className="bg-orange-500 text-white hover:bg-orange-600">
          <Plus className="mr-2 h-4 w-4" /> Tambah Pemain
        </Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Statistik membership">
        <StatCard label="Total Pemain" value={profiles.isLoading ? "—" : totalCount.toLocaleString("id-ID")} icon={<Users />} tint="purple" note="Akun pemain terdaftar" />
        <StatCard label="Pemain Aktif" value={activity.isLoading ? "—" : activeIds.size.toLocaleString("id-ID")} icon={<Activity />} tint="blue" note="Booking terkonfirmasi 90 hari terakhir" />
        <StatCard label="Pemain Baru Bulan Ini" value={activity.isLoading ? "—" : newThisMonth.toLocaleString("id-ID")} icon={<Plus />} tint="green" note="Pemain dengan aktivitas booking baru" />
        <StatCard label="Level Terdaftar" value={profiles.isLoading ? "—" : new Set((profiles.data?.rows ?? []).map((item) => item.level)).size.toString()} icon={<SlidersHorizontal />} tint="orange" note="Level pada halaman ini" />
      </section>

      <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="gap-4 border-b border-slate-100 pb-4">
          <div>
            <CardTitle className="font-display text-lg text-[#142b4d]">Player Database</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Kelola profil pemain, level skill, dan riwayat mabar.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Cari nama atau nomor WhatsApp..." className="w-full bg-transparent text-sm outline-none" />
            </label>
            <select value={level} onChange={(event) => { setLevel(event.target.value); setPage(0); }} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
              <option value="all">Semua Level</option>
              {LEVELS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {profiles.isError || activity.isError ? (
            <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Gagal memuat data Membership: {profiles.error?.message ?? activity.error?.message}</div>
          ) : profiles.isLoading || activity.isLoading ? (
            <div className="space-y-3 p-5">{[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}</div>
          ) : profiles.data?.rows.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">ID Pemain</th><th className="px-4 py-3">Pemain</th><th className="px-4 py-3">Level</th><th className="px-4 py-3">Total Mabar</th><th className="px-4 py-3">Join At</th><th className="px-4 py-3">Terakhir Mabar</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profiles.data.rows.map((profile) => {
                      const bookings = byUser.get(profile.id) ?? [];
                      const confirmed = bookings.filter((item) => item.status === "confirmed");
                      const last = confirmed[0]?.created_at;
                      const isActive = !!last && new Date(last) >= ninetyDaysAgo;
                      return (
                        <tr key={profile.id} className="hover:bg-slate-50/80">
                          <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-500">NWT-{profile.id.slice(0, 6).toUpperCase()}</td>
                          <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e8f1f4] text-xs font-bold text-[#142b4d]">{initials(profile.full_name)}</span><span className="min-w-0"><span className="block max-w-[180px] truncate font-semibold text-slate-800">{profile.full_name || "Tanpa nama"}</span><span className="block text-xs text-slate-500">{profile.whatsapp || "Belum ada nomor WA"}</span></span></div></td>
                          <td className="px-4 py-3"><Badge className={profile.level === "ADVANCE" ? "bg-teal-600" : profile.level === "INTERMEDIATE" ? "bg-orange-500" : "bg-sky-600"}>{profile.level || "GUEST"}</Badge></td>
                          <td className="px-4 py-3 font-medium text-slate-700">{confirmed.length}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{dateLabel(profile.created_at)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{dateLabel(last)}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className={isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}><span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-400"}`} />{isActive ? "Aktif" : "Pasif"}</Badge></td>
                          <td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={`Lihat ${profile.full_name}`} onClick={() => openProfile(profile)}><Eye className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={`Edit ${profile.full_name}`} onClick={() => openProfile(profile, true)}><Pencil className="h-4 w-4" /></Button></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                <span>Menampilkan {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} dari {totalCount} pemain</span>
                <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" /> Sebelumnya</Button><span>Halaman {page + 1} / {pageCount}</span><Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>Berikutnya <ChevronRight className="h-4 w-4" /></Button></div>
              </div>
            </>
          ) : <div className="p-12 text-center"><Users className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">Belum ada pemain ditemukan</p><p className="mt-1 text-sm text-slate-500">Coba ubah kata pencarian atau filter level.</p></div>}
        </CardContent>
      </Card>

      {selected && (
        <section className="space-y-5" aria-label={`Detail pemain ${selected.full_name}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => { setSelected(null); setEditing(false); }} className="-ml-2 text-slate-600">
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Database Pemain
            </Button>
            <div className="flex gap-2">
              {!editing ? <Button onClick={() => setEditing(true)} className="bg-[#142b4d] text-white hover:bg-[#203d65]"><Pencil className="mr-2 h-4 w-4" /> Edit Profil</Button> : null}
            </div>
          </div>

          <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
            <div className="h-2 bg-gradient-to-r from-[#142b4d] via-teal-500 to-cyan-400" />
            <CardContent className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.35fr_1fr]">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full border-4 border-teal-50 bg-[#e5f0f2] font-display text-3xl font-extrabold text-[#142b4d] shadow-inner">{initials(selected.full_name)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Newton Badminton Club • Membership</p>
                  {editing ? (
                    <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); updateProfile.mutate(); }}>
                      <Field label="Nama lengkap"><input required value={draft.full_name} onChange={(event) => setDraft({ ...draft, full_name: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500" /></Field>
                      <Field label="Nomor WhatsApp"><input value={draft.whatsapp} onChange={(event) => setDraft({ ...draft, whatsapp: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500" /></Field>
                      <Field label="Level skill"><select value={draft.level} onChange={(event) => setDraft({ ...draft, level: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">{LEVELS.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
                      <div className="flex items-end gap-2"><Button type="submit" disabled={updateProfile.isPending} className="bg-[#142b4d] text-white">{updateProfile.isPending ? "Menyimpan..." : "Simpan"}</Button><Button type="button" variant="outline" onClick={() => { setEditing(false); setDraft({ full_name: selected.full_name, whatsapp: selected.whatsapp, level: selected.level || "BEGINNER" }); }}>Batal</Button></div>
                      {updateProfile.isError && <p className="text-sm text-red-600 sm:col-span-2">{updateProfile.error.message}</p>}
                    </form>
                  ) : (
                    <>
                      <h2 className="mt-2 truncate font-display text-3xl font-extrabold text-[#142b4d]">{selected.full_name || "Pemain tanpa nama"}</h2>
                      <p className="mt-1 text-sm text-slate-500">ID Pemain NWT-{selected.id.slice(0, 6).toUpperCase()}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge className={selected.level === "ADVANCE" ? "bg-teal-600" : selected.level === "INTERMEDIATE" ? "bg-orange-500" : "bg-sky-600"}>{selected.level || "GUEST"}</Badge>
                        <Badge variant="outline" className={(() => { const last = (byUser.get(selected.id) ?? []).filter((item) => item.status === "confirmed")[0]?.created_at; return last && new Date(last) >= ninetyDaysAgo ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"; })()}>{(() => { const last = (byUser.get(selected.id) ?? []).filter((item) => item.status === "confirmed")[0]?.created_at; return last && new Date(last) >= ninetyDaysAgo ? "Aktif" : "Pasif"; })()}</Badge>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="grid content-center gap-3 sm:grid-cols-2">
                <Info label="Nomor WhatsApp" value={selected.whatsapp || "Belum diisi"} />
                <Info label="Tanggal bergabung" value={dateLabel(selected.created_at)} />
                <Info label="Level skill" value={selected.level || "GUEST"} />
                <Info label="ID akun" value={selected.id.slice(0, 8).toUpperCase()} />
              </div>
            </CardContent>
          </Card>

          {(() => {
            const playerBookings = (byUser.get(selected.id) ?? []).filter((item) => item.status === "confirmed");
            const lastBooking = playerBookings[0];
            const nextBooking = playerBookings.find((item) => item.events?.starts_at && new Date(item.events.starts_at) >= new Date());
            const attendanceMonths = Array.from({ length: 6 }, (_, index) => {
              const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - (5 - index));
              const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
              const count = playerBookings.filter((item) => item.created_at.slice(0, 7) === key).length;
              return { label: new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date), count };
            });
            const maxAttendance = Math.max(1, ...attendanceMonths.map((item) => item.count));
            return (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Total Mabar" value={playerBookings.length.toLocaleString("id-ID")} icon={<Trophy />} tint="purple" note="Booking terkonfirmasi" />
                  <StatCard label="Terakhir Mabar" value={lastBooking ? dateLabel(lastBooking.created_at) : "—"} icon={<Clock3 />} tint="blue" note="Aktivitas terakhir tercatat" />
                  <StatCard label="Bergabung" value={dateLabel(selected.created_at)} icon={<CalendarCheck />} tint="green" note="Tanggal akun dibuat" />
                  <StatCard label="Level Skill" value={selected.level || "GUEST"} icon={<Activity />} tint="orange" note="Klasifikasi pemain saat ini" />
                </div>

                <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                  <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                    <CardHeader><CardTitle className="font-display text-lg text-[#142b4d]">Tren Kehadiran</CardTitle><p className="text-sm text-slate-500">Booking terkonfirmasi per bulan dalam enam bulan terakhir.</p></CardHeader>
                    <CardContent>
                      <div className="flex h-44 items-end justify-between gap-3 border-b border-slate-200 px-2 pb-2">
                        {attendanceMonths.map((month) => <div key={month.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-xs font-semibold text-slate-600">{month.count}</span><div className="w-full max-w-12 rounded-t-lg bg-gradient-to-t from-[#142b4d] to-teal-400" style={{ height: `${Math.max(6, (month.count / maxAttendance) * 112)}px` }} /><span className="text-[11px] text-slate-500">{month.label}</span></div>)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                    <CardHeader><CardTitle className="font-display text-lg text-[#142b4d]">Mabar Berikutnya</CardTitle></CardHeader>
                    <CardContent>
                      {nextBooking ? <div className="rounded-xl bg-teal-50 p-4"><p className="font-bold text-[#142b4d]">{nextBooking.events?.title ?? "Sesi mabar"}</p><p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><CalendarDays className="h-4 w-4" />{dateLabel(nextBooking.events?.starts_at)}</p><p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><MapPin className="h-4 w-4" />{nextBooking.events?.venue ?? "Lokasi belum tersedia"}</p></div> : <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Belum ada booking mendatang yang terkonfirmasi.</div>}
                      <div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Kontak pemain</p><p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><Phone className="h-4 w-4 text-teal-600" />{selected.whatsapp || "Nomor WhatsApp belum tersedia"}</p></div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
                  <CardHeader><CardTitle className="font-display text-lg text-[#142b4d]">Riwayat Mabar</CardTitle><p className="text-sm text-slate-500">Daftar booking terkonfirmasi milik pemain ini.</p></CardHeader>
                  <CardContent className="p-0">
                    {playerBookings.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">Sesi</th><th className="px-5 py-3">Lokasi</th><th className="px-5 py-3">Tanggal booking</th><th className="px-5 py-3">Tanggal sesi</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{playerBookings.map((item, index) => <tr key={`${item.created_at}-${index}`}><td className="px-5 py-3 font-semibold text-slate-800">{item.events?.title ?? "Sesi mabar"}</td><td className="px-5 py-3 text-slate-600">{item.events?.venue ?? "—"}</td><td className="px-5 py-3 text-slate-600">{dateLabel(item.created_at)}</td><td className="px-5 py-3 text-slate-600">{dateLabel(item.events?.starts_at)}</td><td className="px-5 py-3"><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Terkonfirmasi</Badge></td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-slate-500">Belum ada riwayat mabar terkonfirmasi.</p>}
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </section>
      )}

      {showAddInfo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAddInfo(false); }}><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><h2 className="text-lg font-bold text-[#142b4d]">Tambah Pemain</h2><Button variant="ghost" size="icon" onClick={() => setShowAddInfo(false)}><X /></Button></div><p className="mt-3 text-sm leading-relaxed text-slate-600">Profil Membership terhubung ke akun pemain. Untuk menjaga integritas akun dan keamanan akses, pemain perlu mendaftar atau dibuatkan akun terlebih dahulu. Setelah akun tersedia, profilnya akan muncul otomatis di database ini.</p><div className="mt-5 flex justify-end"><Button onClick={() => setShowAddInfo(false)} className="bg-[#142b4d] text-white">Mengerti</Button></div></div></div>}
    </div>
  );
}

function StatCard({ label, value, icon, tint, note }: { label: string; value: string; icon: React.ReactNode; tint: string; note: string }) {
  const tints: Record<string, string> = { purple: "bg-purple-50 text-purple-600", blue: "bg-sky-50 text-sky-600", green: "bg-emerald-50 text-emerald-600", orange: "bg-orange-50 text-orange-600" };
  return <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardContent className="flex items-start justify-between p-4"><div><p className="text-xs font-semibold text-slate-600">{label}</p><p className="mt-1 font-display text-3xl font-extrabold text-[#142b4d]">{value}</p><p className="mt-1 text-[11px] text-slate-500">{note}</p></div><span className={`grid h-9 w-9 place-items-center rounded-xl ${tints[tint]}`}>{icon}</span></CardContent></Card>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5"><span className="text-xs font-semibold text-slate-600">{label}</span>{children}</label>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>; }
