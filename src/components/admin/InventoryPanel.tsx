import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardList, PackagePlus, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/newton-client";

type InventoryItem = {
  id: string; sku: string | null; name: string; category: string; description: string;
  unit: string; quantity: number; minimum_quantity: number; location: string;
  condition_status: "baik" | "perlu_perbaikan" | "rusak"; unit_cost: number | null;
  is_active: boolean; updated_at: string;
};
type Movement = {
  id: string; item_id: string; movement_type: string; quantity_change: number;
  previous_quantity: number; new_quantity: number; reason: string; reference: string | null; created_at: string;
  inventory_items: { name: string; unit: string; sku: string | null } | null;
};
const money = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const dateTime = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
type ConditionStatus = "baik" | "perlu_perbaikan" | "rusak";
type Draft = {
  sku: string; name: string; category: string; description: string; unit: string;
  quantity: string; minimum_quantity: string; location: string;
  condition_status: ConditionStatus; unit_cost: string;
};
const emptyDraft: Draft = { sku: "", name: "", category: "Perlengkapan", description: "", unit: "pcs", quantity: "0", minimum_quantity: "0", location: "", condition_status: "baik", unit_cost: "" };

export function InventoryPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [itemDialog, setItemDialog] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [movement, setMovement] = useState({ movement_type: "stock_in", quantity: "1", reason: "", reference: "" });
  const [tab, setTab] = useState<"items" | "history">("items");

  const items = useQuery({
    queryKey: ["admin-inventory-items", showInactive],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items").select("*").eq("is_active", !showInactive).order("name");
      if (error) throw error;
      return (data ?? []) as InventoryItem[];
    },
  });
  const history = useQuery({
    queryKey: ["admin-inventory-history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_movements")
        .select("id,item_id,movement_type,quantity_change,previous_quantity,new_quantity,reason,reference,created_at,inventory_items(name,unit,sku)")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Movement[];
    },
  });

  const rows = items.data ?? [];
  const categories = useMemo(() => Array.from(new Set(rows.map((item) => item.category))).sort(), [rows]);
  const filtered = rows.filter((item) => (category === "all" || item.category === category) &&
    (!search.trim() || [item.name, item.sku ?? "", item.location].some((value) => value.toLowerCase().includes(search.toLowerCase()))));
  const lowStock = rows.filter((item) => item.quantity <= item.minimum_quantity);
  const totalUnits = rows.reduce((sum, item) => sum + item.quantity, 0);
  const inventoryValue = rows.reduce((sum, item) => sum + (item.unit_cost ?? 0) * item.quantity, 0);

  const saveItem = useMutation({
    mutationFn: async () => {
      const payload = {
        sku: draft.sku.trim() || null, name: draft.name.trim(), category: draft.category.trim() || "Perlengkapan",
        description: draft.description.trim(), unit: draft.unit.trim() || "pcs", minimum_quantity: Math.max(0, Number(draft.minimum_quantity) || 0),
        location: draft.location.trim(), condition_status: draft.condition_status, unit_cost: draft.unit_cost === "" ? null : Math.max(0, Number(draft.unit_cost)),
      };
      if (!payload.name) throw new Error("Nama barang wajib diisi.");
      if (editing) {
        const { error } = await supabase.from("inventory_items").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory_items").insert({ ...payload, quantity: 0 });
        if (error) throw error;
      }
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["admin-inventory-items"] }); setItemDialog(false); setEditing(null); setDraft(emptyDraft); },
  });
  const adjustStock = useMutation({
    mutationFn: async () => {
      if (!movementItem) throw new Error("Pilih barang terlebih dahulu.");
      const amount = Math.floor(Number(movement.quantity));
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Jumlah harus lebih dari nol.");
      if (!movement.reason.trim()) throw new Error("Alasan wajib diisi.");
      const delta = movement.movement_type === "stock_out" ? -amount : movement.movement_type === "adjustment" ? amount : amount;
      const { error } = await supabase.rpc("inventory_adjust_stock", {
        p_item_id: movementItem.id, p_movement_type: movement.movement_type,
        p_quantity_change: delta, p_reason: movement.reason.trim(), p_reference: movement.reference.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ["admin-inventory-items"] }), qc.invalidateQueries({ queryKey: ["admin-inventory-history"] })]);
      setMovementItem(null); setMovement({ movement_type: "stock_in", quantity: "1", reason: "", reference: "" });
    },
  });
  const archiveItem = useMutation({
    mutationFn: async (item: InventoryItem) => {
      const { error } = await supabase.from("inventory_items").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-inventory-items"] }),
  });

  function openNew() { setEditing(null); setDraft(emptyDraft); setItemDialog(true); }
  function openEdit(item: InventoryItem) {
    setEditing(item);
    setDraft({ sku: item.sku ?? "", name: item.name, category: item.category, description: item.description, unit: item.unit, quantity: String(item.quantity), minimum_quantity: String(item.minimum_quantity), location: item.location, condition_status: item.condition_status, unit_cost: item.unit_cost == null ? "" : String(item.unit_cost) });
    setItemDialog(true);
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm text-slate-500">Kelola perlengkapan dan aset operasional klub. Modul ini terpisah dari stok penjualan Club Store.</p></div>
      <Button onClick={openNew} className="bg-orange-500 text-white hover:bg-orange-600"><Plus className="mr-2 h-4 w-4" /> Tambah Barang</Button>
    </div>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Jenis Barang Aktif" value={items.isLoading ? "—" : rows.length.toLocaleString("id-ID")} icon={<Boxes />} />
      <Stat label="Total Unit" value={items.isLoading ? "—" : totalUnits.toLocaleString("id-ID")} icon={<PackagePlus />} />
      <Stat label="Stok Menipis" value={items.isLoading ? "—" : lowStock.length.toLocaleString("id-ID")} icon={<AlertTriangle />} warning={lowStock.length > 0} />
      <Stat label="Estimasi Nilai Aset" value={items.isLoading ? "—" : money(inventoryValue)} icon={<ClipboardList />} />
    </section>
    <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="gap-4 border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><CardTitle className="font-display text-lg text-[#142b4d]">Inventaris Klub</CardTitle><p className="mt-1 text-sm text-slate-500">Data barang, jumlah tersedia, kondisi, dan riwayat pergerakan stok.</p></div>
          <div className="flex gap-2"><Button size="sm" variant={tab === "items" ? "default" : "outline"} onClick={() => setTab("items")}>Daftar Barang</Button><Button size="sm" variant={tab === "history" ? "default" : "outline"} onClick={() => setTab("history")}>Riwayat Stok</Button></div>
        </div>
        {tab === "items" && <div className="flex flex-wrap gap-2">
          <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, SKU, lokasi..." className="w-full bg-transparent text-sm outline-none" /></label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">Semua Kategori</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
          <Button size="sm" variant="outline" onClick={() => setShowInactive((value) => !value)}><SlidersHorizontal className="mr-2 h-4 w-4" />{showInactive ? "Barang Aktif" : "Tampilkan Nonaktif"}</Button>
        </div>}
      </CardHeader>
      <CardContent className="p-0">
        {tab === "items" ? items.isLoading ? <Loading /> : items.isError ? <ErrorBox message={items.error.message} /> : filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Barang</th><th className="px-4 py-3">Kategori</th><th className="px-4 py-3">Lokasi</th><th className="px-4 py-3">Stok</th><th className="px-4 py-3">Kondisi</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{filtered.map((item) => <tr key={item.id} className="hover:bg-slate-50/70">
            <td className="px-4 py-3"><p className="font-semibold text-[#142b4d]">{item.name}</p><p className="text-xs text-slate-500">{item.sku || "Tanpa SKU"} • {item.unit}</p></td>
            <td className="px-4 py-3 text-slate-600">{item.category}</td><td className="px-4 py-3 text-slate-600">{item.location || "—"}</td>
            <td className="px-4 py-3"><span className="font-bold text-[#142b4d]">{item.quantity} {item.unit}</span><p className="text-[11px] text-slate-500">Minimum {item.minimum_quantity}</p>{item.quantity <= item.minimum_quantity && <Badge className="mt-1 bg-orange-100 text-orange-700">Stok menipis</Badge>}</td>
            <td className="px-4 py-3"><Badge variant="outline" className={item.condition_status === "baik" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : item.condition_status === "rusak" ? "border-red-200 bg-red-50 text-red-700" : "border-orange-200 bg-orange-50 text-orange-700"}>{item.condition_status === "baik" ? "Baik" : item.condition_status === "rusak" ? "Rusak" : "Perlu Perbaikan"}</Badge></td>
            <td className="px-4 py-3"><div className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={() => { setMovementItem(item); setMovement({ movement_type: "stock_in", quantity: "1", reason: "", reference: "" }); }}>Atur Stok</Button><Button size="icon" variant="ghost" aria-label="Edit barang" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>{!showInactive && <Button size="icon" variant="ghost" aria-label="Nonaktifkan barang" onClick={() => { if (confirm("Nonaktifkan barang ini? Riwayat stok tetap disimpan.")) archiveItem.mutate(item); }}><Trash2 className="h-4 w-4 text-slate-400" /></Button>}</div></td>
          </tr>)}</tbody></table></div> : <div className="p-12 text-center"><Boxes className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">Belum ada barang inventaris</p><p className="mt-1 text-sm text-slate-500">Tambahkan perlengkapan klub untuk mulai mencatat stok.</p></div>
        : history.isLoading ? <Loading /> : history.isError ? <ErrorBox message={history.error.message} /> : (history.data ?? []).length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Waktu</th><th className="px-4 py-3">Barang</th><th className="px-4 py-3">Jenis</th><th className="px-4 py-3">Perubahan</th><th className="px-4 py-3">Saldo</th><th className="px-4 py-3">Alasan</th></tr></thead><tbody className="divide-y divide-slate-100">{history.data!.map((move) => <tr key={move.id}><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{dateTime(move.created_at)}</td><td className="px-4 py-3 font-semibold text-[#142b4d]">{move.inventory_items?.name ?? "Barang diarsipkan"}</td><td className="px-4 py-3">{move.movement_type === "stock_in" ? "Stok masuk" : move.movement_type === "stock_out" ? "Stok keluar" : "Penyesuaian"}</td><td className={`px-4 py-3 font-bold ${move.quantity_change > 0 ? "text-emerald-600" : "text-red-600"}`}>{move.quantity_change > 0 ? "+" : ""}{move.quantity_change}</td><td className="px-4 py-3">{move.previous_quantity} → {move.new_quantity}</td><td className="px-4 py-3 text-slate-600">{move.reason}{move.reference ? <p className="text-xs text-slate-400">{move.reference}</p> : null}</td></tr>)}</tbody></table></div> : <div className="p-12 text-center text-sm text-slate-500">Belum ada riwayat pergerakan stok.</div>}
      </CardContent>
    </Card>
    {itemDialog && <Modal title={editing ? "Edit Barang Inventaris" : "Tambah Barang Inventaris"} onClose={() => setItemDialog(false)}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); saveItem.mutate(); }}>
        <Field label="Nama Barang" wide><input required autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="field" placeholder="Contoh: Net badminton" /></Field>
        <Field label="SKU / Kode"><input value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} className="field" placeholder="INV-001" /></Field>
        <Field label="Kategori"><input required value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="field" /></Field>
        <Field label="Satuan"><input required value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className="field" placeholder="pcs, set, box" /></Field>
        <Field label="Lokasi Penyimpanan"><input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} className="field" placeholder="Gudang / Court 1" /></Field>
        <Field label="Stok Minimum"><input type="number" min="0" value={draft.minimum_quantity} onChange={(e) => setDraft({ ...draft, minimum_quantity: e.target.value })} className="field" /></Field>
        <Field label="Harga Perolehan / Unit"><input type="number" min="0" value={draft.unit_cost} onChange={(e) => setDraft({ ...draft, unit_cost: e.target.value })} className="field" placeholder="Opsional" /></Field>
        <Field label="Kondisi"><select value={draft.condition_status} onChange={(e) => setDraft({ ...draft, condition_status: e.target.value as typeof draft.condition_status })} className="field"><option value="baik">Baik</option><option value="perlu_perbaikan">Perlu Perbaikan</option><option value="rusak">Rusak</option></select></Field>
        <Field label="Deskripsi" wide><textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="field min-h-20" /></Field>
        {saveItem.isError && <p className="text-sm text-red-600 sm:col-span-2">{saveItem.error.message}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setItemDialog(false)}>Batal</Button><Button type="submit" disabled={saveItem.isPending} className="bg-[#142b4d] text-white">{saveItem.isPending ? "Menyimpan..." : "Simpan Barang"}</Button></div>
      </form>
    </Modal>}
    {movementItem && <Modal title={`Pergerakan Stok • ${movementItem.name}`} onClose={() => setMovementItem(null)}>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); adjustStock.mutate(); }}>
        <div className="rounded-xl bg-slate-50 p-3 text-sm">Stok saat ini: <strong>{movementItem.quantity} {movementItem.unit}</strong></div>
        <Field label="Jenis Pergerakan"><select value={movement.movement_type} onChange={(e) => setMovement({ ...movement, movement_type: e.target.value })} className="field"><option value="stock_in">Stok Masuk</option><option value="stock_out">Stok Keluar</option><option value="adjustment">Penyesuaian (+)</option></select></Field>
        <Field label="Jumlah"><input type="number" min="1" required value={movement.quantity} onChange={(e) => setMovement({ ...movement, quantity: e.target.value })} className="field" /></Field>
        <Field label="Alasan / Keterangan"><input required value={movement.reason} onChange={(e) => setMovement({ ...movement, reason: e.target.value })} className="field" placeholder="Pembelian, pemakaian latihan, koreksi..." /></Field>
        <Field label="Referensi (opsional)"><input value={movement.reference} onChange={(e) => setMovement({ ...movement, reference: e.target.value })} className="field" placeholder="Nomor nota / dokumen" /></Field>
        {adjustStock.isError && <p className="text-sm text-red-600">{adjustStock.error.message}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setMovementItem(null)}>Batal</Button><Button type="submit" disabled={adjustStock.isPending} className="bg-[#142b4d] text-white">{adjustStock.isPending ? "Menyimpan..." : "Simpan Pergerakan"}</Button></div>
      </form>
    </Modal>}
  </div>;
}

function Stat({ label, value, icon, warning = false }: { label: string; value: string; icon: React.ReactNode; warning?: boolean }) {
  return <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardContent className="flex items-start justify-between p-4"><div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 font-display text-2xl font-extrabold text-[#142b4d]">{value}</p></div><span className={`grid h-9 w-9 place-items-center rounded-xl ${warning ? "bg-orange-50 text-orange-600" : "bg-teal-50 text-teal-700"}`}>{icon}</span></CardContent></Card>;
}
function Loading() { return <div className="space-y-3 p-5">{[0,1,2,3].map((n) => <div key={n} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}</div>; }
function ErrorBox({ message }: { message: string }) { return <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>; }
function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={`grid gap-1.5 text-xs font-semibold text-slate-600 ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>; }
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label={title} className="my-8 w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h3 className="font-display text-lg font-bold text-[#142b4d]">{title}</h3><Button size="icon" variant="ghost" onClick={onClose} aria-label="Tutup"><X className="h-4 w-4" /></Button></div>{children}</section></div>; }
