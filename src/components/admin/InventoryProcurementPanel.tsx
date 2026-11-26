import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, ShoppingCart, Truck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/newton-client";

type Supplier = { id: string; name: string; contact_person: string; phone: string; email: string; address: string; notes: string; is_active: boolean };
type Item = { id: string; name: string; sku: string | null; unit: string; quantity: number };
type Purchase = { id: string; purchase_code: string; purchased_at: string; total_amount: number; notes: string; created_at: string; inventory_suppliers: { name: string } | null };
type Line = { item_id: string; quantity: string; unit_cost: string };
const money = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const supplierDraft = { name: "", contact_person: "", phone: "", email: "", address: "", notes: "" };

export function InventoryProcurementPanel() {
  const qc = useQueryClient();
  const [view, setView] = useState<"suppliers" | "purchases">("purchases");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState(supplierDraft);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ item_id: "", quantity: "1", unit_cost: "0" }]);

  const suppliers = useQuery({ queryKey: ["inventory-suppliers"], queryFn: async () => {
    const { data, error } = await supabase.from("inventory_suppliers").select("*").eq("is_active", true).order("name");
    if (error) throw error; return (data ?? []) as Supplier[];
  }});
  const items = useQuery({ queryKey: ["admin-inventory-items", false], queryFn: async () => {
    const { data, error } = await supabase.from("inventory_items").select("id,name,sku,unit,quantity").eq("is_active", true).order("name");
    if (error) throw error; return (data ?? []) as Item[];
  }});
  const purchases = useQuery({ queryKey: ["inventory-purchases"], queryFn: async () => {
    const { data, error } = await supabase.from("inventory_purchases").select("id,purchase_code,purchased_at,total_amount,notes,created_at,inventory_suppliers(name)").order("created_at", { ascending: false }).limit(100);
    if (error) throw error; return (data ?? []) as unknown as Purchase[];
  }});

  const saveSupplier = useMutation({ mutationFn: async () => {
    if (!supplierForm.name.trim()) throw new Error("Nama supplier wajib diisi.");
    const { error } = await supabase.from("inventory_suppliers").insert({ ...supplierForm, name: supplierForm.name.trim() });
    if (error) throw error;
  }, onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["inventory-suppliers"] }); setSupplierOpen(false); setSupplierForm(supplierDraft); } });

  const receivePurchase = useMutation({ mutationFn: async () => {
    const cleanLines = lines.map((line) => ({ item_id: line.item_id, quantity: Math.floor(Number(line.quantity)), unit_cost: Math.floor(Number(line.unit_cost)) }));
    if (cleanLines.some((line) => !line.item_id || !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.unit_cost) || line.unit_cost < 0)) throw new Error("Lengkapi barang, jumlah, dan harga setiap baris.");
    if (new Set(cleanLines.map((line) => line.item_id)).size !== cleanLines.length) throw new Error("Barang yang sama tidak boleh ditambahkan dua kali. Gabungkan jumlahnya dalam satu baris.");
    const { data, error } = await supabase.rpc("inventory_receive_purchase", { p_supplier_id: supplierId || null, p_items: cleanLines, p_purchased_at: purchasedAt, p_notes: notes.trim() });
    if (error) throw error; return data;
  }, onSuccess: async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ["admin-inventory-items"] }), qc.invalidateQueries({ queryKey: ["admin-inventory-history"] }), qc.invalidateQueries({ queryKey: ["inventory-purchases"] })]);
    setPurchaseOpen(false); setLines([{ item_id: "", quantity: "1", unit_cost: "0" }]); setNotes(""); setSupplierId("");
  }});

  const total = lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unit_cost) || 0), 0);

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-display text-lg font-bold text-[#142b4d]">Supplier & Pembelian</h3><p className="text-sm text-slate-500">Kelola pemasok dan catat penerimaan barang yang otomatis menambah stok.</p></div>
      <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setView("suppliers")}> <Building2 className="mr-2 h-4 w-4"/>Supplier</Button><Button size="sm" variant="outline" onClick={() => setView("purchases")}><ShoppingCart className="mr-2 h-4 w-4"/>Pembelian</Button></div>
    </div>
    {view === "suppliers" ? <Card className="rounded-2xl border-slate-200 shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-[#142b4d]">Daftar Supplier</CardTitle><Button size="sm" onClick={() => setSupplierOpen(true)} className="bg-orange-500 text-white"><Plus className="mr-1 h-4 w-4"/>Tambah Supplier</Button></CardHeader><CardContent>
      {suppliers.isLoading ? <p className="text-sm text-slate-500">Memuat supplier...</p> : suppliers.isError ? <p className="text-sm text-red-600">{suppliers.error.message}</p> : suppliers.data?.length ? <div className="divide-y divide-slate-100">{suppliers.data.map((s) => <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold text-[#142b4d]">{s.name}</p><p className="text-xs text-slate-500">{s.contact_person || "Kontak belum diisi"} {s.phone ? "• "+s.phone : ""} {s.email ? "• "+s.email : ""}</p><p className="text-xs text-slate-400">{s.address}</p></div><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Aktif</Badge></div>)}</div> : <div className="py-10 text-center text-sm text-slate-500">Belum ada supplier. Tambahkan pemasok pertama.</div>}
    </CardContent></Card> : <Card className="rounded-2xl border-slate-200 shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-[#142b4d]">Riwayat Pembelian</CardTitle><p className="mt-1 text-sm text-slate-500">Penerimaan barang dan total nilai pembelian.</p></div><Button size="sm" onClick={() => setPurchaseOpen(true)} className="bg-orange-500 text-white"><Plus className="mr-1 h-4 w-4"/>Catat Pembelian</Button></CardHeader><CardContent>
      {purchases.isLoading ? <p className="text-sm text-slate-500">Memuat pembelian...</p> : purchases.isError ? <p className="text-sm text-red-600">{purchases.error.message}</p> : purchases.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-3">Kode</th><th className="px-3 py-3">Tanggal</th><th className="px-3 py-3">Supplier</th><th className="px-3 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{purchases.data.map((p) => <tr key={p.id}><td className="px-3 py-3 font-semibold text-[#142b4d]">{p.purchase_code}</td><td className="px-3 py-3">{new Date(p.purchased_at+"T00:00:00").toLocaleDateString("id-ID")}</td><td className="px-3 py-3">{p.inventory_suppliers?.name ?? "Tanpa supplier"}</td><td className="px-3 py-3 text-right font-semibold">{money(p.total_amount)}</td></tr>)}</tbody></table></div> : <div className="py-10 text-center text-sm text-slate-500"><Truck className="mx-auto mb-2 h-8 w-8 text-slate-300"/>Belum ada riwayat pembelian.</div>}
    </CardContent></Card>}
    {supplierOpen && <Modal title="Tambah Supplier" onClose={() => setSupplierOpen(false)}><form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); saveSupplier.mutate(); }}>
      <Field label="Nama Supplier" wide><input required className="field" value={supplierForm.name} onChange={(e) => setSupplierForm({...supplierForm,name:e.target.value})}/></Field>
      <Field label="Nama Kontak"><input className="field" value={supplierForm.contact_person} onChange={(e) => setSupplierForm({...supplierForm,contact_person:e.target.value})}/></Field>
      <Field label="Nomor Telepon"><input className="field" value={supplierForm.phone} onChange={(e) => setSupplierForm({...supplierForm,phone:e.target.value})}/></Field>
      <Field label="Email"><input type="email" className="field" value={supplierForm.email} onChange={(e) => setSupplierForm({...supplierForm,email:e.target.value})}/></Field>
      <Field label="Alamat" wide><textarea className="field min-h-16" value={supplierForm.address} onChange={(e) => setSupplierForm({...supplierForm,address:e.target.value})}/></Field>
      {saveSupplier.isError && <p className="text-sm text-red-600 sm:col-span-2">{saveSupplier.error.message}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setSupplierOpen(false)}>Batal</Button><Button disabled={saveSupplier.isPending} className="bg-[#142b4d] text-white">Simpan Supplier</Button></div>
    </form></Modal>}
    {purchaseOpen && <Modal title="Catat Pembelian & Terima Stok" onClose={() => setPurchaseOpen(false)}><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); receivePurchase.mutate(); }}>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Supplier"><select className="field" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">Tanpa supplier</option>{(suppliers.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Tanggal Pembelian"><input required type="date" className="field" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)}/></Field></div>
      <div className="space-y-2"><div className="flex items-center justify-between"><p className="text-sm font-bold text-[#142b4d]">Barang Dibeli</p><Button type="button" size="sm" variant="outline" onClick={() => setLines([...lines,{item_id:"",quantity:"1",unit_cost:"0"}])}><Plus className="mr-1 h-3 w-3"/>Tambah Baris</Button></div>
        {lines.map((line,index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_76px_110px_32px] items-end gap-2"><Field label={index===0?"Barang":`Barang ${index+1}`}><select required className="field min-w-0" value={line.item_id} onChange={(e) => setLines(lines.map((v,i) => i===index?{...v,item_id:e.target.value}:v))}><option value="">Pilih</option>{(items.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.quantity} {item.unit})</option>)}</select></Field><Field label="Qty"><input required type="number" min="1" className="field" value={line.quantity} onChange={(e) => setLines(lines.map((v,i) => i===index?{...v,quantity:e.target.value}:v))}/></Field><Field label="Harga/unit"><input required type="number" min="0" className="field" value={line.unit_cost} onChange={(e) => setLines(lines.map((v,i) => i===index?{...v,unit_cost:e.target.value}:v))}/></Field><Button type="button" size="icon" variant="ghost" disabled={lines.length===1} onClick={() => setLines(lines.filter((_,i)=>i!==index))} aria-label="Hapus baris"><X className="h-4 w-4"/></Button></div>)}
      </div>
      <Field label="Catatan"><textarea className="field min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)}/></Field>
      <div className="rounded-xl bg-slate-50 p-3 text-right"><p className="text-xs text-slate-500">Total pembelian</p><p className="text-xl font-extrabold text-[#142b4d]">{money(total)}</p><p className="text-xs text-slate-500">Stok akan langsung bertambah setelah disimpan.</p></div>
      {receivePurchase.isError && <p className="text-sm text-red-600">{receivePurchase.error.message}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setPurchaseOpen(false)}>Batal</Button><Button disabled={receivePurchase.isPending} className="bg-[#142b4d] text-white">{receivePurchase.isPending?"Menyimpan...":"Simpan & Terima Stok"}</Button></div>
    </form></Modal>}
  </div>;
}
function Field({label,children,wide=false}:{label:string;children:React.ReactNode;wide?:boolean}) { return <label className={`grid gap-1.5 text-xs font-semibold text-slate-600 ${wide?"sm:col-span-2":""}`}>{label}{children}</label>; }
function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}) { return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose();}}><section role="dialog" aria-modal="true" aria-label={title} className="my-8 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h3 className="font-display text-lg font-bold text-[#142b4d]">{title}</h3><Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4"/></Button></div>{children}</section></div>; }
