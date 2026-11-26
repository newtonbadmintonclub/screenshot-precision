import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, RefreshCw, Wallet, TrendingDown, TrendingUp, ReceiptText, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RefundPanel } from "@/components/admin/RefundPanel";
import { supabase } from "@/lib/newton-client";
import { useAuth } from "@/hooks/use-auth";

type BookingIncome = { id: string; code: string; player_name: string; amount: number; paid_at: string | null; created_at: string };
type StoreIncome = { id: string; code: string; product_name: string; total: number; created_at: string };
type Expense = { id: string; expense_date: string; category: string; description: string; amount: number; vendor: string; payment_method: string; reference: string; notes: string; created_at: string };
type CostSource = { id: string; amount: number; date: string; label: string };
type Tab = "overview" | "expenses" | "refunds";

const CATEGORIES = ["Operasional", "Sewa Lapangan", "Perlengkapan", "Transportasi", "Konsumsi", "Marketing", "Utilitas", "Lainnya"];
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
const today = () => new Date().toLocaleDateString("en-CA");
const firstDay = () => { const d = new Date(); d.setDate(1); return d.toLocaleDateString("en-CA"); };
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join(String.fromCharCode(13, 10));
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
function Metric({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) {
  return <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardContent className="flex items-start justify-between p-4"><div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 font-display text-xl font-extrabold text-[#142b4d] sm:text-2xl">{value}</p></div><span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}>{icon}</span></CardContent></Card>;
}

export function FinancePanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(today);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("Operasional");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today);
  const [vendor, setVendor] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const finance = useQuery({
    queryKey: ["admin-finance", from, to],
    queryFn: async () => {
      const [bookings, orders, expenses, purchases, maintenance] = await Promise.all([
        supabase.from("bookings").select("id,code,player_name,amount,paid_at,created_at").eq("status", "confirmed").not("paid_at", "is", null).gte("paid_at", from + "T00:00:00").lte("paid_at", to + "T23:59:59").order("paid_at", { ascending: false }),
        supabase.from("orders").select("id,code,product_name,total,created_at").eq("status", "selesai").gte("created_at", from + "T00:00:00").lte("created_at", to + "T23:59:59").order("created_at", { ascending: false }),
        supabase.from("finance_expenses").select("id,expense_date,category,description,amount,vendor,payment_method,reference,notes,created_at").gte("expense_date", from).lte("expense_date", to).order("expense_date", { ascending: false }),
        supabase.from("inventory_purchases").select("id,purchase_code,total_amount,purchased_at").gte("purchased_at", from).lte("purchased_at", to),
        supabase.from("fixed_asset_maintenance").select("id,cost,maintenance_date,description").gte("maintenance_date", from).lte("maintenance_date", to),
      ]);
      const failed = [bookings, orders, expenses, purchases, maintenance].find((item) => item.error);
      if (failed?.error) throw failed.error;
      return {
        bookings: (bookings.data ?? []) as BookingIncome[],
        orders: (orders.data ?? []) as StoreIncome[],
        expenses: (expenses.data ?? []) as Expense[],
        purchases: (purchases.data ?? []).map((r: any) => ({ id: r.id, amount: Number(r.total_amount), date: r.purchased_at, label: r.purchase_code })) as CostSource[],
        maintenance: (maintenance.data ?? []).map((r: any) => ({ id: r.id, amount: Number(r.cost), date: r.maintenance_date, label: r.description })) as CostSource[],
      };
    },
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const addExpense = useMutation({
    mutationFn: async () => {
      const parsed = Number(amount);
      if (!description.trim() || !Number.isSafeInteger(parsed) || parsed <= 0) throw new Error("Isi deskripsi dan nominal pengeluaran yang valid.");
      const { error } = await supabase.from("finance_expenses").insert({
        expense_date: expenseDate, category, description: description.trim(), amount: parsed,
        vendor: vendor.trim(), payment_method: paymentMethod, reference: reference.trim(), notes: notes.trim(), created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-finance"] });
      setDescription(""); setAmount(""); setVendor(""); setReference(""); setNotes(""); setShowForm(false);
    },
  });
  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-finance"] }),
  });

  const totals = useMemo(() => {
    const d = finance.data;
    if (!d) return { booking: 0, store: 0, expense: 0, purchases: 0, maintenance: 0, refund: 0, income: 0, cost: 0, net: 0 };
    const booking = d.bookings.reduce((s, r) => s + Number(r.amount), 0);
    const store = d.orders.reduce((s, r) => s + Number(r.total), 0);
    const expense = d.expenses.reduce((s, r) => s + Number(r.amount), 0);
    const purchases = d.purchases.reduce((s, r) => s + r.amount, 0);
    const maintenance = d.maintenance.reduce((s, r) => s + r.amount, 0);
    const income = booking + store, cost = expense + purchases + maintenance;
    return { booking, store, expense, purchases, maintenance, refund: 0, income, cost, net: income - cost };
  }, [finance.data]);

  function exportReport() {
    const d = finance.data;
    if (!d) return;
    downloadCsv(`laporan-keuangan-${from}-${to}.csv`, [
      ["Jenis", "Tanggal", "Referensi", "Keterangan", "Kategori", "Pemasukan", "Pengeluaran"],
      ...d.bookings.map((r) => ["Booking", r.paid_at, r.code, r.player_name, "Booking", r.amount, 0]),
      ...d.orders.map((r) => ["Club Store", r.created_at, r.code, r.product_name, "Penjualan", r.total, 0]),
      ...d.expenses.map((r) => ["Pengeluaran", r.expense_date, r.reference, r.description, r.category, 0, r.amount]),
      ...d.purchases.map((r) => ["Pembelian Inventaris", r.date, r.label, r.label, "Inventaris", 0, r.amount]),
      ...d.maintenance.map((r) => ["Perawatan Aset", r.date, r.id, r.label, "Perawatan", 0, r.amount]),
      ["TOTAL", "", "", "", "", totals.income, totals.cost],
    ]);
  }

  const tabs: { id: Tab; label: string }[] = [{ id: "overview", label: "Ringkasan" }, { id: "expenses", label: "Pengeluaran" }, { id: "refunds", label: "Refund" }];
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-sm text-slate-500">Pantau arus kas berdasarkan transaksi yang tercatat.</p><div className="mt-3 flex flex-wrap gap-2"><label className="text-xs font-semibold text-slate-500">Dari<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 block h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-700" /></label><label className="text-xs font-semibold text-slate-500">Sampai<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="mt-1 block h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-700" /></label></div></div>
      <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void finance.refetch()} disabled={finance.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${finance.isFetching ? "animate-spin" : ""}`} />Perbarui</Button><Button size="sm" onClick={exportReport} disabled={!finance.data} className="bg-[#0E9AA7] text-white hover:bg-[#087f89]"><Download className="mr-2 h-4 w-4" />Ekspor CSV</Button></div>
    </div>
    <div className="flex gap-2 border-b border-slate-200">{tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === item.id ? "border-[#0E9AA7] text-[#0E9AA7]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{item.label}</button>)}</div>
    {finance.isError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Gagal memuat data keuangan: {finance.error.message}</div>}
    {finance.isLoading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}</div> : null}
    {tab === "overview" && <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total Pemasukan" value={money(totals.income)} icon={<TrendingUp />} tone="bg-emerald-50 text-emerald-600" /><Metric label="Total Pengeluaran" value={money(totals.cost)} icon={<TrendingDown />} tone="bg-orange-50 text-orange-600" /><Metric label="Saldo Bersih Periode" value={money(totals.net)} icon={<Wallet />} tone="bg-sky-50 text-sky-600" /><Metric label="Transaksi Pemasukan" value={(finance.data?.bookings.length ?? 0) + (finance.data?.orders.length ?? 0) + " transaksi"} icon={<ReceiptText />} tone="bg-purple-50 text-purple-600" /></section>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base text-[#142b4d]">Sumber pemasukan</CardTitle><CardDescription>Hanya booking berstatus terkonfirmasi dengan waktu pembayaran dan pesanan toko berstatus selesai.</CardDescription></CardHeader><CardContent className="space-y-4"><Line label="Booking Mabar" value={totals.booking} total={totals.income} /><Line label="Club Store" value={totals.store} total={totals.income} /></CardContent></Card>
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base text-[#142b4d]">Sumber pengeluaran</CardTitle><CardDescription>Pembelian inventaris dan biaya perawatan aset dihitung terpisah dari pengeluaran operasional manual.</CardDescription></CardHeader><CardContent className="space-y-4"><Line label="Pengeluaran operasional" value={totals.expense} total={totals.cost} /><Line label="Pembelian inventaris" value={totals.purchases} total={totals.cost} /><Line label="Perawatan aset tetap" value={totals.maintenance} total={totals.cost} /></CardContent></Card>
      </div>
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base text-[#142b4d]">Transaksi pemasukan terbaru</CardTitle></CardHeader><CardContent className="space-y-3">{[...(finance.data?.bookings ?? []).map((r) => ({ id:r.id, title:r.player_name, ref:r.code, date:r.paid_at ?? r.created_at, amount:Number(r.amount), kind:"Booking" })), ...(finance.data?.orders ?? []).map((r) => ({ id:r.id, title:r.product_name, ref:r.code, date:r.created_at, amount:Number(r.total), kind:"Club Store" }))].sort((a,b) => new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,8).map((r) => <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 last:border-0"><div><p className="text-sm font-semibold text-slate-800">{r.title}</p><p className="text-xs text-slate-500">{r.kind} • {r.ref} • {new Date(r.date).toLocaleString("id-ID")}</p></div><p className="text-sm font-bold text-emerald-700">+{money(r.amount)}</p></div>)}{!finance.data?.bookings.length && !finance.data?.orders.length && <p className="py-6 text-center text-sm text-slate-500">Belum ada pemasukan terkonfirmasi pada periode ini.</p>}</CardContent></Card>
    </div>}
    {tab === "expenses" && <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-display text-lg font-bold text-[#142b4d]">Catatan pengeluaran operasional</h2><p className="text-xs text-slate-500">Catat biaya di luar pembelian inventaris dan perawatan aset yang sudah direkap otomatis.</p></div><Button size="sm" onClick={() => setShowForm((v) => !v)} className="bg-orange-500 text-white hover:bg-orange-600"><Plus className="mr-1 h-4 w-4" />Catat Pengeluaran</Button></div>
      {showForm && <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base">Pengeluaran baru</CardTitle></CardHeader><CardContent><form onSubmit={(e) => { e.preventDefault(); addExpense.mutate(); }} className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">Tanggal<input required type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600">Kategori<select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm">{CATEGORIES.map((v) => <option key={v}>{v}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Deskripsi<input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contoh: biaya listrik bulan ini" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600">Nominal (Rp)<input required min="1" step="1" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600">Penerima / Vendor<input value={vendor} onChange={(e) => setVendor(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600">Metode pembayaran<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"><option value="transfer">Transfer</option><option value="cash">Tunai</option><option value="qris">QRIS</option><option value="other">Lainnya</option></select></label>
        <label className="text-xs font-semibold text-slate-600">Referensi<input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Catatan<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        {addExpense.isError && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{addExpense.error.message}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Batal</Button><Button type="submit" disabled={addExpense.isPending} className="bg-[#0E9AA7] text-white">{addExpense.isPending ? "Menyimpan..." : "Simpan Pengeluaran"}</Button></div>
      </form></CardContent></Card>}
      <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm"><CardContent className="p-0">{finance.data?.expenses.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Deskripsi</th><th className="px-4 py-3">Kategori</th><th className="px-4 py-3">Vendor</th><th className="px-4 py-3 text-right">Nominal</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100">{finance.data.expenses.map((r) => <tr key={r.id}><td className="whitespace-nowrap px-4 py-3 text-slate-500">{r.expense_date}</td><td className="px-4 py-3"><p className="font-semibold text-slate-800">{r.description}</p><p className="text-xs text-slate-500">{r.reference || r.payment_method}</p></td><td className="px-4 py-3"><Badge variant="outline">{r.category}</Badge></td><td className="px-4 py-3 text-slate-600">{r.vendor || "—"}</td><td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-800">{money(r.amount)}</td><td className="px-4 py-3 text-right"><Button variant="ghost" size="icon" aria-label="Hapus pengeluaran" disabled={deleteExpense.isPending} onClick={() => { if (window.confirm("Hapus catatan pengeluaran ini?")) deleteExpense.mutate(r.id); }}><Trash2 className="h-4 w-4 text-red-500" /></Button></td></tr>)}</tbody></table></div> : <div className="p-10 text-center text-sm text-slate-500">Belum ada pengeluaran operasional pada periode ini.</div>}</CardContent></Card>
    </div>}
    {tab === "refunds" && <RefundPanel />}
    <p className="text-xs leading-relaxed text-slate-400">Catatan akuntansi: pemasukan booking hanya menghitung status confirmed dengan paid_at terisi; Club Store hanya menghitung pesanan selesai. Pengeluaran menggabungkan catatan operasional, penerimaan pembelian inventaris, dan biaya perawatan aset. Refund dipantau pada tab terpisah dan tidak otomatis mengurangi pemasukan sampai pencatatan refund diselesaikan secara manual.</p>
  </div>;
}

function Line({ label, value, total }: { label: string; value: number; total: number }) {
  const width = total > 0 ? Math.min(100, value / total * 100) : 0;
  return <div><div className="mb-1 flex justify-between gap-2 text-sm"><span className="text-slate-600">{label}</span><strong className="text-[#142b4d]">{money(value)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#0E9AA7]" style={{ width: width + "%" }} /></div></div>;
}
