import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Download, Dices, RefreshCw, Search, Swords, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/newton-client";

type EventOption = { id: string; title: string; starts_at: string; venue: string; courts: string[] };
type Player = { id: string; code: string; player_name: string; whatsapp: string; level: string; created_at: string };
type Match = { id: string; court: string; players: Player[]; teamA: Player[]; teamB: Player[] };
const LEVEL_SCORE: Record<string, number> = { Beginner: 1, Intermediate: 2, Advance: 3 };
const LEVEL_LABEL: Record<string, string> = { Beginner: "Beginner", Intermediate: "Intermediate", Advance: "Advance" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}
function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}
function buildMatches(players: Player[], courts: string[], seed: number): { matches: Match[]; waiting: Player[] } {
  const byLevel = (level: string) => shuffle(players.filter((player) => player.level === level));
  const randomized = [
    ...byLevel("Advance"),
    ...byLevel("Intermediate"),
    ...byLevel("Beginner"),
    ...shuffle(players.filter((player) => !["Advance", "Intermediate", "Beginner"].includes(player.level))),
  ];
  const matches: Match[] = [];
  const usableCourts = courts.length ? courts : ["Lapangan 1"];
  for (let index = 0; index + 3 < randomized.length; index += 4) {
    const quartet = randomized.slice(index, index + 4);
    const teamA = [quartet[0], quartet[3]];
    const teamB = [quartet[1], quartet[2]];
    matches.push({
      id: `match-${seed}-${index / 4}`,
      court: usableCourts[(index / 4) % usableCourts.length],
      players: quartet,
      teamA,
      teamB,
    });
  }
  return { matches, waiting: randomized.slice(matches.length * 4) };
}

export function MatchmakingPanel() {
  const [eventId, setEventId] = useState("");
  const [search, setSearch] = useState("");
  const [seed, setSeed] = useState(0);
  const events = useQuery({
    queryKey: ["admin-matchmaking-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("id,title,starts_at,venue,courts").order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventOption[];
    },
    staleTime: 60_000,
  });
  const selectedEvent = events.data?.find((event) => event.id === eventId);
  const players = useQuery({
    queryKey: ["admin-matchmaking-players", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id,code,player_name,whatsapp,level,created_at")
        .eq("event_id", eventId)
        .eq("status", "confirmed")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Player[];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const generated = useMemo(
    () => buildMatches(players.data ?? [], selectedEvent?.courts ?? [], seed),
    [players.data, selectedEvent?.courts, seed],
  );
  const visiblePlayers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("id-ID");
    if (!term) return players.data ?? [];
    return (players.data ?? []).filter((player) =>
      [player.player_name, player.code, player.whatsapp, player.level].some((value) => value.toLocaleLowerCase("id-ID").includes(term)),
    );
  }, [players.data, search]);
  const levelCounts = useMemo(() => {
    const counts = { Beginner: 0, Intermediate: 0, Advance: 0 };
    (players.data ?? []).forEach((player) => {
      if (player.level in counts) counts[player.level as keyof typeof counts] += 1;
    });
    return counts;
  }, [players.data]);

  function exportCsv() {
    if (!generated.matches.length) return;
    const rows = [
      ["Pertandingan", "Lapangan", "Tim", "Nama Pemain", "Level", "Kode Booking", "WhatsApp"],
      ...generated.matches.flatMap((match, index) => [
        ...match.teamA.map((player) => [index + 1, match.court, "Tim A", player.player_name, player.level, player.code, player.whatsapp]),
        ...match.teamB.map((player) => [index + 1, match.court, "Tim B", player.player_name, player.level, player.code, player.whatsapp]),
      ]),
      ...generated.waiting.map((player) => ["Cadangan", "Belum ditentukan", "Menunggu", player.player_name, player.level, player.code, player.whatsapp]),
    ];
    const csv = String.fromCharCode(0xFEFF) + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `matchmaking-${selectedEvent?.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "newton"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Pemain terkonfirmasi" value={players.data?.length} icon={<Users />} />
        <Metric label="Pertandingan disusun" value={generated.matches.length} icon={<Swords />} />
        <Metric label="Pemain menunggu" value={generated.waiting.length} icon={<CalendarDays />} />
        <Metric label="Lapangan tersedia" value={selectedEvent?.courts?.length ?? 0} icon={<Dices />} />
      </div>

      <div className="rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3">
        <p className="text-sm font-bold text-[#142b4d]">Penyusunan pertandingan ganda</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">Sistem hanya mengambil booking berstatus Terkonfirmasi. Pemain dikelompokkan per 4 orang dan level dipasangkan secara seimbang. Hasil ini merupakan rancangan untuk Admin, tidak mengubah booking, pembayaran, atau jadwal pemain.</p>
      </div>

      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="font-display text-lg text-[#142b4d]">Pilih jadwal mabar</CardTitle>
          <CardDescription>Pilih sesi untuk melihat pemain yang sudah terkonfirmasi dan menyusun pasangan.</CardDescription>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <select aria-label="Pilih jadwal mabar" value={eventId} onChange={(event) => { setEventId(event.target.value); setSeed(0); }} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
              <option value="">Pilih jadwal mabar...</option>
              {(events.data ?? []).map((event) => <option key={event.id} value={event.id}>{event.title} — {formatDate(event.starts_at)}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={() => { void Promise.all([events.refetch(), players.refetch()]); }} disabled={events.isFetching || players.isFetching} className="h-10 border-slate-200">
              <RefreshCw className={`mr-2 h-4 w-4 ${events.isFetching || players.isFetching ? "animate-spin" : ""}`} /> Perbarui
            </Button>
          </div>
          {selectedEvent && <p className="text-xs text-slate-500">{selectedEvent.venue} • {selectedEvent.courts?.length ? selectedEvent.courts.join(", ") : "Lapangan belum ditentukan"}</p>}
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          {events.isError ? <ErrorText message={events.error.message} /> :
            events.isLoading ? <div className="h-20 animate-pulse rounded-xl bg-slate-100" /> :
            !eventId ? <EmptyState title="Pilih jadwal terlebih dahulu" message="Daftar pemain akan ditampilkan setelah jadwal dipilih." /> :
            players.isError ? <ErrorText message={players.error.message} /> :
            players.isLoading ? <div className="h-24 animate-pulse rounded-xl bg-slate-100" /> :
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <LevelCount label="Beginner" count={levelCounts.Beginner} />
                <LevelCount label="Intermediate" count={levelCounts.Intermediate} />
                <LevelCount label="Advance" count={levelCounts.Advance} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-[#142b4d]">Hasil penyusunan</h3>
                  <p className="text-xs text-slate-500">4 pemain per pertandingan • 2 lawan 2</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSeed((value) => value + 1)} disabled={(players.data?.length ?? 0) < 4}>
                    <Dices className="mr-2 h-4 w-4" /> Acak ulang
                  </Button>
                  <Button size="sm" onClick={exportCsv} disabled={!generated.matches.length} className="bg-[#0e9aa7] text-white hover:bg-[#087d88]">
                    <Download className="mr-2 h-4 w-4" /> Export CSV
                  </Button>
                </div>
              </div>
              {generated.matches.length ? (
                <div className="grid gap-3 xl:grid-cols-2">
                  {generated.matches.map((match, index) => (
                    <Card key={match.id} className="overflow-hidden rounded-xl border-slate-200 shadow-none">
                      <div className="flex items-center justify-between bg-[#142b4d] px-4 py-3 text-white">
                        <div><p className="text-sm font-bold">Pertandingan {index + 1}</p><p className="text-[11px] text-white/70">{match.court}</p></div>
                        <Badge className="border-white/20 bg-white/10 text-white">Ganda • 2 vs 2</Badge>
                      </div>
                      <CardContent className="grid gap-3 p-3 sm:grid-cols-2">
                        <TeamColumn label="Tim A" players={match.teamA} tint="teal" />
                        <TeamColumn label="Tim B" players={match.teamB} tint="orange" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : <EmptyState title="Belum cukup pemain" message="Minimal 4 booking terkonfirmasi diperlukan untuk menyusun satu pertandingan ganda." />}
              {generated.waiting.length > 0 && (
                <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4">
                  <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-[#142b4d]">Pemain menunggu giliran</p><Badge variant="outline" className="border-orange-200 text-orange-700">{generated.waiting.length} pemain</Badge></div>
                  <div className="mt-3 flex flex-wrap gap-2">{generated.waiting.map((player) => <span key={player.id} className="rounded-lg border border-orange-100 bg-white px-3 py-2 text-xs font-medium text-slate-700">{player.player_name} <span className="text-slate-400">· {player.level}</span></span>)}</div>
                </div>
              )}
            </>}
        </CardContent>
      </Card>

      {eventId && !players.isLoading && !players.isError && (
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="font-display text-lg text-[#142b4d]">Daftar pemain terkonfirmasi</CardTitle><CardDescription>Data sumber penyusunan pertandingan, tidak termasuk waiting list atau pembayaran pending.</CardDescription></div>
            <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 sm:w-64"><Search className="h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari pemain..." className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label>
          </CardHeader>
          <CardContent className="p-0">
            {visiblePlayers.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Pemain</th><th className="px-4 py-3">Level</th><th className="px-4 py-3">Kode Booking</th><th className="px-4 py-3">WhatsApp</th></tr></thead><tbody className="divide-y divide-slate-100">{visiblePlayers.map((player) => <tr key={player.id}><td className="px-4 py-3 font-semibold text-[#142b4d]">{player.player_name}</td><td className="px-4 py-3"><LevelBadge level={player.level} /></td><td className="px-4 py-3 text-xs text-slate-600">{player.code}</td><td className="px-4 py-3 text-xs text-slate-600">{player.whatsapp}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-slate-500">Tidak ada pemain yang cocok dengan pencarian.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value?: number; icon: React.ReactNode }) {
  return <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardContent className="flex items-start justify-between p-4"><div><p className="text-xs font-semibold text-slate-600">{label}</p><p className="mt-1 font-display text-3xl font-extrabold text-[#142b4d]">{value === undefined ? "—" : value.toLocaleString("id-ID")}</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-700">{icon}</span></CardContent></Card>;
}
function TeamColumn({ label, players, tint }: { label: string; players: Player[]; tint: "teal" | "orange" }) {
  return <div className={`rounded-lg border p-3 ${tint === "teal" ? "border-teal-100 bg-teal-50/50" : "border-orange-100 bg-orange-50/50"}`}><p className={`mb-2 text-xs font-extrabold ${tint === "teal" ? "text-teal-800" : "text-orange-800"}`}>{label}</p><div className="space-y-2">{players.map((player) => <div key={player.id} className="rounded-lg border border-white bg-white px-3 py-2"><p className="text-sm font-bold text-[#142b4d]">{player.player_name}</p><div className="mt-1 flex items-center justify-between gap-2"><LevelBadge level={player.level} /><span className="text-[10px] text-slate-400">{player.code}</span></div></div>)}</div></div>;
}
function LevelBadge({ level }: { level: string }) {
  const style = level === "Advance" ? "border-purple-200 bg-purple-50 text-purple-700" : level === "Beginner" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-teal-200 bg-teal-50 text-teal-700";
  return <Badge variant="outline" className={style}>{LEVEL_LABEL[level] ?? level}</Badge>;
}
function LevelCount({ label, count }: { label: string; count: number }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"><p className="text-[11px] font-semibold text-slate-500">{label}</p><p className="font-display text-xl font-extrabold text-[#142b4d]">{count}</p></div>;
}
function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center"><Swords className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-700">{title}</p><p className="mt-1 text-xs text-slate-500">{message}</p></div>;
}
function ErrorText({ message }: { message: string }) {
  return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Gagal memuat data: {message}</div>;
}
