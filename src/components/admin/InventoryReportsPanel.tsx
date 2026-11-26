import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownToLine, CalendarDays, ClipboardList, Package, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/newton-client";

type Item = { id: string; sku: string | null; name: string; category: string; unit: string; quantity: number; minimum_quantity: number; location: string; condition_status: string; unit_cost: number | null; is_active: boolean };
type Movement = { id: string; item_id: string; movement_type: string; quantity_change: number; previous_quantity: number; new_quantity: number; reason: string; reference: string | null; created_at: string; inventory_items: { name: string; sku: string | null; unit: string } | null };
type Purchase = { id: string; purchase_code: string; purchased_at: string; total_amount: number; notes: string; inventory_suppliers: { name: string } | null };
type PurchaseLine = { purchase_id: string; quantity: number; unit_cost: number; line_total: number; inventory_items: { name: string; sku: string | null; unit: string } | null };
type Loan = { id: string; loan_code: string; borrower_name: string; borrower_type: string; borrower_contact: string; purpose: string; borrowed_at: string; due_at: string | null; status: string; inventory_loan_items: { quantity_borrowed: number; quantity_returned: number; inventory_items: { name: string; sku: string | null; unit: string } | null }[] };

const today = () => new Date().toLocaleDateString("en-CA");
const currency = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value)) : "—";
const csvCell = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

export function InventoryReportsPanel() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toLocaleDateString("en-CA"); });
  const [to, setTo] = useState(today);
  const report = useQuery({
    queryKey: ["admin-inventory-reports", from, to],
    queryFn: async () => {
      const [itemsRes, movementsRes, purchasesRes, linesRes, loansRes] = await Promise.all([
        supabase.from("inventory_items").select("id,sku,name,category,unit,quantity,minimum_quantity,location,condition_status,unit_cost,is_active").order("name"),
        supabase.from("inventory_movements").select("id,item_id,movement_type,quantity_change,previous_quantity,new_quantity,reason,reference,created_at,inventory_items(name,sku,unit)").gte("created_at", from + "T00:00:00").lte("created_at", to + "T23:59:59.999").order("created_at", { ascending: false }),
        supabase.from("inventory_purchases").select("id,purchase_code,purchased_at,total_amount,notes,inventory_suppliers(name)").gte("purchased_at", from).lte("purchased_at", to).order("purchased_at", { ascending: false }),
        supabase.from("inventory_purchase_items").select("purchase_id,quantity,unit_cost,line_total,inventory_items(name,sku,unit)"),
        supabase.from("inventory_loans").select("id,loan_code,borrower_name,borrower_type,borrower_contact,purpose,borrowed_at,due_at,status,inventory_loan_items(quantity_borrowed,quantity_returned,inventory_items(name,sku,unit))").order("borrowed_at", { ascending: false }),
      ]);
      for (const result of [itemsRes, movementsRes, purchasesRes, linesRes, loansRes]) if (result.error) throw result.error;
      return { items: (itemsRes.data ?? []) as Item[], movements: (movementsRes.data ?? []) as unknown as Movement[], purchases: (purchasesRes.data ?? []) as unknown as Purchase[], lines: (linesRes.data ?? []) as unknown as PurchaseLine[], loans: (loansRes.data ?? []) as unknown as Loan[] };
    },
  });
  const data = report.data;
  const activeItems = (data?.items ?? []).filter((item) => item.is_active);
  const lowStock = activeItems.filter((item) => item.quantity <= item.minimum_quantity);
  const totalUnits = activeItems.reduce((sum, item) => sum + item.quantity, 0);
  const assetValue = activeItems.reduce((sum, item) => sum + item.quantity * (item.unit_cost ?? 0), 0);
  const purchaseTotal = (data?.purchases ?? []).reduce((sum, purchase) => sum + Number(purchase.total_amount), 0);
  const overdue = (data?.loans ?? []).filter((loan) => loan.status !== "returned" && loan.due_at && loan.due_at < today());
  const maintenance = activeItems.filter((item) => item.condition_status !== "baik");
  const loanLines = useMemo(() => (data?.loans ?? []).flatMap((loan) => loan.inventory_loan_items.map((line) => ({ loan, line, remaining: line.quantity_borrowed - line.quantity_returned }))), [data?.loans]);

  const exportStock = () => downloadCsv("laporan-stok-inventaris-" + from + "-" + to + ".csv", [
    ["SKU", "Nama Barang", "Kategori", "Lokasi", "Stok", "Stok Minimum", "Satuan", "Kondisi", "Harga Perolehan/Unit", "Nilai Stok", "Status"],
    ...(data?.items ?? []).map((item) => [item.sku, item.name, item.category, item.location, item.quantity, item.minimum_quantity, item.unit, item.condition_status, item.unit_cost, item.quantity * (item.unit_cost ?? 0), item.is_active ? "Aktif" : "Nonaktif"]),
  ]);
  const exportMovements = () => downloadCsv("laporan-pergerakan-stok-" + from + "-" + to + ".csv", [
    ["Tanggal", "SKU", "Nama Barang", "Jenis", "Perubahan", "Saldo Sebelum", "Saldo Sesudah", "Alasan", "Referensi"],
    ...(data?.movements ?? []).map((move) => [dateLabel(move.created_at), move.inventory_items?.sku, move.inventory_items?.name, move.movement_type, move.quantity_change, move.previous_quantity, move.new_quantity, move.reason, move.reference]),
  ]);
  const exportPurchases = () => downloadCsv("laporan-pembelian-" + from + "-" + to + ".csv", [
    ["Tanggal", "Kode Pembelian", "Supplier", "Nama Barang", "Jumlah", "Harga/Unit", "Subtotal", "Catatan"],
    ...(data?.purchases ?? []).flatMap((purchase) => {
      const lines = (data?.lines ?? []).filter((line) => line.purchase_id === purchase.id);
      return lines.length ? lines.map((line) => [purchase.purchased_at, purchase.purchase_code, purchase.inventory_suppliers?.name, line.inventory_items?.name, line.quantity, line.unit_cost, line.line_total, purchase.notes]) : [[purchase.purchased_at, purchase.purchase_code, purchase.inventory_suppliers?.name, "", "", "", purchase.total_amount, purchase.notes]];
    }),
  ]);
  const exportLoans = () => downloadCsv("laporan-peminjaman-" + from + "-" + to + ".csv", [
    ["Kode", "Peminjam", "Jenis", "Kontak", "Keperluan", "Tanggal Pinjam", "Jatuh Tempo", "Status", "Barang", "Dipinjam", "Dikembalikan", "Belum Kembali"],
    ...loanLines.filter(({ loan }) => loan.borrowed_at.slice(0, 10) >= from && loan.borrowed_at.slice(0, 10) <= to).map(({ loan, line, remaining }) => [loan.loan_code, loan.borrower_name, loan.borrower_type, loan.borrower_contact, loan.purpose, dateLabel(loan.borrowed_at), loan.due_at, loan.status, line.inventory_items?.name, line.quantity_borrowed, line.quantity_returned, remaining]),
  ]);

  if (report.isLoading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Memuat laporan inventaris…</div>;
  if (report.isError) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{report.error.message}</div>;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="font-display text-xl font-bold text-[#142b4d]">Laporan Inventaris</h2><p className="mt-1 text-sm text-slate-500">Ringkasan stok, pembelian, peminjaman, dan kondisi aset klub.</p></div>
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <label className="grid gap-1 text-xs font-semibold text-slate-500">Dari tanggal<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-700" /></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-500">Sampai tanggal<input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-700" /></label>
      </div>
    </div>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={<Package />} label="Total Unit Aktif" value={totalUnits.toLocaleString("id-ID")} />
      <Metric icon={<AlertTriangle />} label="Stok di Bawah Minimum" value={String(lowStock.length)} warning={lowStock.length > 0} />
      <Metric icon={<ClipboardList />} label="Nilai Stok Saat Ini" value={currency(assetValue)} />
      <Metric icon={<CalendarDays />} label="Pembelian Periode" value={currency(purchaseTotal)} />
    </section>
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader><CardTitle className="text-base text-[#142b4d]">Stok Minimum & Kondisi</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm"><span className="text-slate-600">Barang perlu perbaikan / rusak</span><Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">{maintenance.length} barang</Badge></div>
          <div className="max-h-64 space-y-2 overflow-auto">{lowStock.length ? lowStock.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-orange-50/70 px-3 py-2 text-sm"><div><p className="font-semibold text-slate-800">{item.name}</p><p className="text-xs text-slate-500">{item.sku || "Tanpa SKU"} · Minimum {item.minimum_quantity}</p></div><span className="font-bold text-orange-700">{item.quantity} {item.unit}</span></div>) : <p className="py-4 text-sm text-slate-500">Tidak ada barang di bawah stok minimum.</p>}</div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader><CardTitle className="text-base text-[#142b4d]">Peminjaman Terlambat</CardTitle></CardHeader>
        <CardContent className="space-y-2">{overdue.length ? overdue.map((loan) => <div key={loan.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-100 bg-red-50/60 px-3 py-2"><div><p className="text-sm font-semibold text-slate-800">{loan.borrower_name} · {loan.loan_code}</p><p className="text-xs text-slate-500">Jatuh tempo {dateLabel(loan.due_at)}</p></div><Badge className="bg-red-100 text-red-700">Terlambat</Badge></div>) : <p className="py-4 text-sm text-slate-500">Tidak ada peminjaman terlambat.</p>}</CardContent>
      </Card>
    </div>
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader><CardTitle className="text-base text-[#142b4d]">Export Laporan Excel</CardTitle><p className="text-sm text-slate-500">Unduh file CSV berformat UTF-8 yang dapat dibuka langsung menggunakan Microsoft Excel. Data transaksi mengikuti rentang tanggal di atas.</p></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ExportButton label="Laporan Stok" detail="Seluruh barang dan nilai stok" onClick={exportStock} />
        <ExportButton label="Pergerakan Stok" detail="Barang masuk dan keluar" onClick={exportMovements} />
        <ExportButton label="Pembelian" detail="Supplier dan rincian pembelian" onClick={exportPurchases} />
        <ExportButton label="Peminjaman" detail="Status dan sisa pengembalian" onClick={exportLoans} />
      </CardContent>
    </Card>
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader><CardTitle className="text-base text-[#142b4d]">Ringkasan Pergerakan Stok</CardTitle><p className="text-sm text-slate-500">Aktivitas pada {dateLabel(from)} – {dateLabel(to)}.</p></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-700">Stok Masuk</p><p className="mt-1 text-2xl font-bold text-emerald-800">{(data?.movements ?? []).filter((m) => m.quantity_change > 0).reduce((s, m) => s + m.quantity_change, 0).toLocaleString("id-ID")}</p></div>
        <div className="rounded-xl bg-red-50 p-4"><p className="text-xs font-semibold text-red-700">Stok Keluar</p><p className="mt-1 text-2xl font-bold text-red-800">{Math.abs((data?.movements ?? []).filter((m) => m.quantity_change < 0).reduce((s, m) => s + m.quantity_change, 0)).toLocaleString("id-ID")}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-600">Jumlah Transaksi</p><p className="mt-1 text-2xl font-bold text-[#142b4d]">{(data?.movements ?? []).length.toLocaleString("id-ID")}</p></div>
      </CardContent>
    </Card>
  </div>;
}

function Metric({ icon, label, value, warning = false }: { icon: React.ReactNode; label: string; value: string; warning?: boolean }) {
  return <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardContent className="flex items-start justify-between p-4"><div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 font-display text-xl font-extrabold text-[#142b4d]">{value}</p></div><span className={`grid h-9 w-9 place-items-center rounded-xl ${warning ? "bg-orange-50 text-orange-600" : "bg-teal-50 text-teal-700"}`}>{icon}</span></CardContent></Card>;
}
function ExportButton({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
  return <Button variant="outline" onClick={onClick} className="h-auto justify-between gap-3 border-slate-200 px-3 py-3 text-left"><span><span className="block font-semibold text-[#142b4d]">{label}</span><span className="mt-1 block text-xs font-normal text-slate-500">{detail}</span></span><ArrowDownToLine className="h-4 w-4 shrink-0 text-teal-700" /></Button>;
}
