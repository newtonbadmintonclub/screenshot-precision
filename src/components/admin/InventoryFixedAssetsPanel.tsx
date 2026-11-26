import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, Download, Plus, Search, Wrench, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/newton-client";

type Asset = {
  id: string; asset_code: string; name: string; category: string; description: string;
  serial_number: string | null; purchase_date: string; purchase_cost: number; salvage_value: number;
  useful_life_months: number; warranty_expires_at: string | null; location: string;
  condition_status: "baik" | "perlu_perbaikan" | "rusak"; status: "active" | "maintenance" | "disposed";
  notes: string; created_at: string;
};
type Maintenance = {
  id: string; asset_id: string; maintenance_date: string; maintenance_type: string;
  description: string; cost: number; performed_by: string; next_maintenance_date: string | null;
  fixed_assets?: { asset_code: string; name: string } | null;
};
type Draft = Omit<Asset, "id" | "created_at">;
const emptyDraft: Draft = { asset_code: "", name: "", category: "Peralatan", description: "", serial_number: "", purchase_date: new Date().toISOString().slice(0,10), purchase_cost: 0, salvage_value: 0, useful_life_months: 60, warranty_expires_at: null, location: "", condition_status: "baik", status: "active", notes: "" };
const money = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
const monthsElapsed = (date: string) => Math.max(0, (new Date().getFullYear() - new Date(date).getFullYear()) * 12 + new Date().getMonth() - new Date(date).getMonth());
function depreciation(asset: Asset) {
  const depreciable = Math.max(0, Number(asset.purchase_cost) - Number(asset.salvage_value));
  const elapsed = Math.min(asset.useful_life_months, monthsElapsed(asset.purchase_date));
  const accumulated = Math.min(depreciable, depreciable / asset.useful_life_months * elapsed);
  return { accumulated, bookValue: Math.max(Number(asset.salvage_value), Number(asset.purchase_cost) - accumulated) };
}
const csv = (rows: unknown[][]) => String.fromCharCode(0xFEFF) + rows.map(r => r.map(v => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(";")).join(String.fromCharCode(13, 10));
function exportAssets(assets: Asset[]) {
  const content = csv([["Kode Aset","Nama","Kategori","Serial Number","Tanggal Perolehan","Harga Perolehan","Nilai Residu","Umur Manfaat (bulan)","Akumulasi Penyusutan","Nilai Buku","Garansi","Lokasi","Kondisi","Status"], ...assets.map(a => { const d=depreciation(a); return [a.asset_code,a.name,a.category,a.serial_number,a.purchase_date,a.purchase_cost,a.salvage_value,a.useful_life_months,Math.round(d.accumulated),Math.round(d.bookValue),a.warranty_expires_at,a.location,a.condition_status,a.status]; })]);
  const url = URL.createObjectURL(new Blob([content], {type:"text/csv;charset=utf-8;"}));
  const link = document.createElement("a"); link.href=url; link.download="daftar-aset-tetap.csv"; link.click(); URL.revokeObjectURL(url);
}
export function InventoryFixedAssetsPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [assetDraft, setAssetDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [assetOpen, setAssetOpen] = useState(false);
  const [maintenanceAsset, setMaintenanceAsset] = useState<Asset | null>(null);
  const [maintenanceDraft, setMaintenanceDraft] = useState({ maintenance_date: new Date().toISOString().slice(0,10), maintenance_type: "perawatan", description: "", cost: "0", performed_by: "", next_maintenance_date: "" });

  const assetsQuery = useQuery({ queryKey:["admin-fixed-assets"], queryFn: async () => {
    const {data,error}=await supabase.from("fixed_assets").select("*").order("purchase_date",{ascending:false});
    if(error) throw error; return (data ?? []) as Asset[];
  }});
  const maintenanceQuery = useQuery({ queryKey:["admin-fixed-asset-maintenance"], queryFn: async () => {
    const {data,error}=await supabase.from("fixed_asset_maintenance").select("*,fixed_assets(asset_code,name)").order("maintenance_date",{ascending:false}).limit(100);
    if(error) throw error; return (data ?? []) as Maintenance[];
  }});
  const assets = assetsQuery.data ?? [];
  const filtered = useMemo(() => assets.filter(a => [a.asset_code,a.name,a.category,a.serial_number ?? "",a.location].some(v=>v.toLowerCase().includes(search.toLowerCase()))),[assets,search]);
  const today = new Date().toISOString().slice(0,10);
  const reminderLimit = new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const latestScheduleByAsset = new Map<string, Maintenance>();
  for (const entry of maintenanceQuery.data ?? []) {
    if (!latestScheduleByAsset.has(entry.asset_id)) latestScheduleByAsset.set(entry.asset_id, entry);
  }
  const upcomingMaintenance = [...latestScheduleByAsset.values()]
    .filter(entry => entry.next_maintenance_date && entry.next_maintenance_date <= reminderLimit)
    .sort((a,b) => (a.next_maintenance_date ?? "").localeCompare(b.next_maintenance_date ?? ""));
  const overdueMaintenanceCount = upcomingMaintenance.filter(entry => (entry.next_maintenance_date ?? "") < today).length;
  const totalCost = assets.filter(a=>a.status!=="disposed").reduce((s,a)=>s+Number(a.purchase_cost),0);
  const totalBook = assets.filter(a=>a.status!=="disposed").reduce((s,a)=>s+depreciation(a).bookValue,0);
  const warrantyDue = assets.filter(a=>a.status!=="disposed" && a.warranty_expires_at && a.warranty_expires_at >= new Date().toISOString().slice(0,10) && a.warranty_expires_at <= new Date(Date.now()+30*86400000).toISOString().slice(0,10)).length;

  const saveAsset = useMutation({ mutationFn: async () => {
    const payload = {...assetDraft, asset_code:assetDraft.asset_code.trim().toUpperCase(), name:assetDraft.name.trim(), serial_number:assetDraft.serial_number?.trim() || null, warranty_expires_at:assetDraft.warranty_expires_at || null, purchase_cost:Number(assetDraft.purchase_cost), salvage_value:Number(assetDraft.salvage_value), useful_life_months:Number(assetDraft.useful_life_months)};
    if(!payload.asset_code || !payload.name) throw new Error("Kode dan nama aset wajib diisi.");
    if(payload.salvage_value > payload.purchase_cost) throw new Error("Nilai residu tidak boleh melebihi harga perolehan.");
    if(editing) { const {error}=await supabase.from("fixed_assets").update({...payload,updated_at:new Date().toISOString()}).eq("id",editing.id); if(error) throw error; }
    else { const {data:userData}=await supabase.auth.getUser(); const {error}=await supabase.from("fixed_assets").insert({...payload,created_by:userData.user?.id ?? null}); if(error) throw error; }
  },onSuccess:async()=>{await qc.invalidateQueries({queryKey:["admin-fixed-assets"]});setAssetOpen(false);setEditing(null);setAssetDraft(emptyDraft);}});
  const saveMaintenance = useMutation({ mutationFn: async () => {
    if(!maintenanceAsset) throw new Error("Pilih aset terlebih dahulu.");
    if(!maintenanceDraft.description.trim()) throw new Error("Deskripsi pekerjaan wajib diisi.");
    const {data:userData}=await supabase.auth.getUser();
    const {error}=await supabase.from("fixed_asset_maintenance").insert({asset_id:maintenanceAsset.id,maintenance_date:maintenanceDraft.maintenance_date,maintenance_type:maintenanceDraft.maintenance_type,description:maintenanceDraft.description.trim(),cost:Math.max(0,Number(maintenanceDraft.cost)||0),performed_by:maintenanceDraft.performed_by.trim(),next_maintenance_date:maintenanceDraft.next_maintenance_date||null,created_by:userData.user?.id??null});
    if(error) throw error;
  },onSuccess:async()=>{await Promise.all([qc.invalidateQueries({queryKey:["admin-fixed-assets"]}),qc.invalidateQueries({queryKey:["admin-fixed-asset-maintenance"]})]);setMaintenanceAsset(null);setMaintenanceDraft({maintenance_date:new Date().toISOString().slice(0,10),maintenance_type:"perawatan",description:"",cost:"0",performed_by:"",next_maintenance_date:""});}});
  const openEdit = (a:Asset) => {setEditing(a);setAssetDraft({...a,serial_number:a.serial_number??"",warranty_expires_at:a.warranty_expires_at??""} as Draft);setAssetOpen(true);};
  const field = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700";
  if(assetsQuery.isLoading) return <div className="rounded-2xl border bg-white p-8 text-sm text-slate-500">Memuat daftar aset tetap…</div>;
  if(assetsQuery.isError) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{assetsQuery.error.message}</div>;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-display text-xl font-bold text-[#142b4d]">Manajemen Aset Tetap</h2><p className="mt-1 text-sm text-slate-500">Registrasi aset bernilai jangka panjang, penyusutan garis lurus, garansi, dan riwayat perawatan.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={()=>exportAssets(assets)}><Download className="mr-2 h-4 w-4"/>Export CSV</Button><Button onClick={()=>{setEditing(null);setAssetDraft(emptyDraft);setAssetOpen(true);}} className="bg-orange-500 text-white hover:bg-orange-600"><Plus className="mr-2 h-4 w-4"/>Tambah Aset</Button></div>
    </div>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Summary label="Jumlah Aset" value={String(assets.filter(a=>a.status!=="disposed").length)}/>
      <Summary label="Total Harga Perolehan" value={money(totalCost)}/>
      <Summary label="Estimasi Nilai Buku" value={money(totalBook)}/>
      <Summary label="Garansi Berakhir ≤30 Hari" value={String(warrantyDue)}/>
    </section>
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-base text-[#142b4d]">Register Aset</CardTitle><p className="text-sm text-slate-500">Penyusutan dihitung secara garis lurus per bulan sejak tanggal perolehan.</p></div><label className="flex h-10 min-w-[220px] items-center gap-2 rounded-lg border px-3"><Search className="h-4 w-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari kode, nama, serial..." className="w-full bg-transparent text-sm outline-none"/></label></CardHeader>
      <CardContent className="p-0">{filtered.length===0?<p className="p-10 text-center text-sm text-slate-500">Belum ada aset tetap. Tambahkan aset pertama untuk memulai pencatatan.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">Aset</th><th className="px-4 py-3">Perolehan</th><th className="px-4 py-3">Nilai Buku</th><th className="px-4 py-3">Garansi</th><th className="px-4 py-3">Kondisi</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(a=>{const d=depreciation(a);return <tr key={a.id}><td className="px-4 py-3"><p className="font-semibold text-[#142b4d]">{a.name}</p><p className="text-xs text-slate-500">{a.asset_code} · {a.category} · {a.location||"Lokasi belum diisi"}</p></td><td className="px-4 py-3"><p className="font-semibold">{money(a.purchase_cost)}</p><p className="text-xs text-slate-500">{a.purchase_date}</p></td><td className="px-4 py-3"><p className="font-semibold text-teal-700">{money(d.bookValue)}</p><p className="text-xs text-slate-500">Susut {money(d.accumulated)}</p></td><td className="px-4 py-3 text-xs">{a.warranty_expires_at??"—"}</td><td className="px-4 py-3"><Badge variant="outline">{a.condition_status==="baik"?"Baik":a.condition_status==="rusak"?"Rusak":"Perlu Perbaikan"}</Badge></td><td className="px-4 py-3"><Badge className={a.status==="active"?"bg-emerald-50 text-emerald-700":a.status==="maintenance"?"bg-orange-50 text-orange-700":"bg-slate-100 text-slate-600"}>{a.status==="active"?"Aktif":a.status==="maintenance"?"Dalam Perawatan":"Dilepas"}</Badge></td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={()=>setMaintenanceAsset(a)}><Wrench className="mr-1 h-3.5 w-3.5"/>Perawatan</Button><Button size="sm" variant="outline" onClick={()=>openEdit(a)}>Edit</Button></div></td></tr>})}</tbody></table></div>}</CardContent>
    </Card>
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle className="text-base text-[#142b4d]">Pengingat Jadwal Perawatan</CardTitle><p className="text-sm text-slate-500">Jadwal terdekat dan yang sudah melewati tanggal perawatan.</p></div>{overdueMaintenanceCount>0&&<Badge className="bg-red-50 text-red-700">{overdueMaintenanceCount} Terlambat</Badge>}</CardHeader><CardContent>{maintenanceQuery.isLoading?<p className="text-sm text-slate-500">Memuat jadwal…</p>:maintenanceQuery.isError?<p className="text-sm text-red-600">{maintenanceQuery.error.message}</p>:upcomingMaintenance.length===0?<p className="text-sm text-slate-500">Tidak ada jadwal perawatan yang jatuh tempo dalam 30 hari ke depan.</p>:<div className="space-y-2">{upcomingMaintenance.map(entry=>{const overdue=(entry.next_maintenance_date??"")<today;return <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"><div className="flex items-start gap-2"><AlertTriangle className={overdue?"mt-0.5 h-4 w-4 text-red-600":"mt-0.5 h-4 w-4 text-orange-500"}/><div><p className="font-semibold text-[#142b4d]">{entry.fixed_assets?.name??"Aset"} · {entry.fixed_assets?.asset_code??""}</p><p className="text-xs text-slate-500">Rencana berikutnya: {entry.next_maintenance_date}</p></div></div><Badge className={overdue?"bg-red-50 text-red-700":"bg-orange-50 text-orange-700"}>{overdue?"Terlambat":"Segera"}</Badge></div>})}</div>}</CardContent></Card>
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base text-[#142b4d]">Riwayat Perawatan Terbaru</CardTitle></CardHeader><CardContent>{maintenanceQuery.isLoading?<p className="text-sm text-slate-500">Memuat riwayat…</p>:maintenanceQuery.isError?<p className="text-sm text-red-600">{maintenanceQuery.error.message}</p>:(maintenanceQuery.data??[]).length===0?<p className="text-sm text-slate-500">Belum ada riwayat perawatan aset.</p>:<div className="space-y-2">{maintenanceQuery.data!.map(m=><div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"><div><p className="font-semibold text-[#142b4d]">{m.fixed_assets?.name??"Aset"} · {m.fixed_assets?.asset_code??""}</p><p className="text-xs text-slate-500">{m.maintenance_date} · {m.maintenance_type} · {m.description}</p></div><div className="text-right text-sm"><p className="font-semibold">{money(m.cost)}</p><p className="text-xs text-slate-500">{m.performed_by||"Pelaksana belum dicatat"}</p></div></div>)}</div>}</CardContent></Card>

    {assetOpen&&<div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"><section role="dialog" aria-modal="true" className="my-8 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h3 className="font-display text-lg font-bold text-[#142b4d]">{editing?"Edit Aset Tetap":"Registrasi Aset Tetap"}</h3><Button size="icon" variant="ghost" onClick={()=>setAssetOpen(false)}><X className="h-4 w-4"/></Button></div><form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();saveAsset.mutate();}}>
      <Field label="Kode Aset"><input required className={field} value={assetDraft.asset_code} onChange={e=>setAssetDraft({...assetDraft,asset_code:e.target.value})} placeholder="AST-0001"/></Field>
      <Field label="Nama Aset"><input required className={field} value={assetDraft.name} onChange={e=>setAssetDraft({...assetDraft,name:e.target.value})}/></Field>
      <Field label="Kategori"><input className={field} value={assetDraft.category} onChange={e=>setAssetDraft({...assetDraft,category:e.target.value})}/></Field>
      <Field label="Nomor Seri"><input className={field} value={assetDraft.serial_number??""} onChange={e=>setAssetDraft({...assetDraft,serial_number:e.target.value})}/></Field>
      <Field label="Tanggal Perolehan"><input required type="date" className={field} value={assetDraft.purchase_date} onChange={e=>setAssetDraft({...assetDraft,purchase_date:e.target.value})}/></Field>
      <Field label="Harga Perolehan (Rp)"><input required type="number" min="0" className={field} value={assetDraft.purchase_cost} onChange={e=>setAssetDraft({...assetDraft,purchase_cost:Number(e.target.value)})}/></Field>
      <Field label="Nilai Residu (Rp)"><input type="number" min="0" className={field} value={assetDraft.salvage_value} onChange={e=>setAssetDraft({...assetDraft,salvage_value:Number(e.target.value)})}/></Field>
      <Field label="Umur Manfaat (bulan)"><input required type="number" min="1" className={field} value={assetDraft.useful_life_months} onChange={e=>setAssetDraft({...assetDraft,useful_life_months:Number(e.target.value)})}/></Field>
      <Field label="Garansi Berakhir"><input type="date" className={field} value={assetDraft.warranty_expires_at??""} onChange={e=>setAssetDraft({...assetDraft,warranty_expires_at:e.target.value||null})}/></Field>
      <Field label="Lokasi"><input className={field} value={assetDraft.location} onChange={e=>setAssetDraft({...assetDraft,location:e.target.value})}/></Field>
      <Field label="Kondisi"><select className={field} value={assetDraft.condition_status} onChange={e=>setAssetDraft({...assetDraft,condition_status:e.target.value as Draft["condition_status"]})}><option value="baik">Baik</option><option value="perlu_perbaikan">Perlu Perbaikan</option><option value="rusak">Rusak</option></select></Field>
      <Field label="Status"><select className={field} value={assetDraft.status} onChange={e=>setAssetDraft({...assetDraft,status:e.target.value as Draft["status"]})}><option value="active">Aktif</option><option value="maintenance">Dalam Perawatan</option><option value="disposed">Dilepas</option></select></Field>
      <Field label="Deskripsi"><input className={field} value={assetDraft.description} onChange={e=>setAssetDraft({...assetDraft,description:e.target.value})}/></Field>
      <Field label="Catatan"><input className={field} value={assetDraft.notes} onChange={e=>setAssetDraft({...assetDraft,notes:e.target.value})}/></Field>
      {saveAsset.isError&&<p className="text-sm text-red-600 sm:col-span-2">{saveAsset.error.message}</p>}<div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={()=>setAssetOpen(false)}>Batal</Button><Button type="submit" disabled={saveAsset.isPending} className="bg-[#142b4d] text-white">{saveAsset.isPending?"Menyimpan…":"Simpan Aset"}</Button></div>
    </form></section></div>}
    {maintenanceAsset&&<div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"><section role="dialog" aria-modal="true" className="my-8 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h3 className="font-display font-bold text-[#142b4d]">Catat Perawatan · {maintenanceAsset.asset_code}</h3><Button size="icon" variant="ghost" onClick={()=>setMaintenanceAsset(null)}><X className="h-4 w-4"/></Button></div><form className="grid gap-3" onSubmit={e=>{e.preventDefault();saveMaintenance.mutate();}}>
      <Field label="Tanggal"><input required type="date" className={field} value={maintenanceDraft.maintenance_date} onChange={e=>setMaintenanceDraft({...maintenanceDraft,maintenance_date:e.target.value})}/></Field>
      <Field label="Jenis"><select className={field} value={maintenanceDraft.maintenance_type} onChange={e=>setMaintenanceDraft({...maintenanceDraft,maintenance_type:e.target.value})}><option value="perawatan">Perawatan</option><option value="perbaikan">Perbaikan</option><option value="inspeksi">Inspeksi</option></select></Field>
      <Field label="Deskripsi"><textarea required className="min-h-20 rounded-lg border border-slate-200 p-3 text-sm" value={maintenanceDraft.description} onChange={e=>setMaintenanceDraft({...maintenanceDraft,description:e.target.value})}/></Field>
      <Field label="Biaya (Rp)"><input type="number" min="0" className={field} value={maintenanceDraft.cost} onChange={e=>setMaintenanceDraft({...maintenanceDraft,cost:e.target.value})}/></Field>
      <Field label="Pelaksana"><input className={field} value={maintenanceDraft.performed_by} onChange={e=>setMaintenanceDraft({...maintenanceDraft,performed_by:e.target.value})}/></Field>
      <Field label="Jadwal Perawatan Berikutnya"><input type="date" className={field} value={maintenanceDraft.next_maintenance_date} onChange={e=>setMaintenanceDraft({...maintenanceDraft,next_maintenance_date:e.target.value})}/></Field>
      {saveMaintenance.isError&&<p className="text-sm text-red-600">{saveMaintenance.error.message}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setMaintenanceAsset(null)}>Batal</Button><Button type="submit" disabled={saveMaintenance.isPending} className="bg-[#142b4d] text-white">{saveMaintenance.isPending?"Menyimpan…":"Simpan Riwayat"}</Button></div>
    </form></section></div>}
  </div>;
}
function Summary({label,value}:{label:string;value:string}){return <Card className="rounded-2xl border-slate-200 bg-white shadow-sm"><CardContent className="p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 font-display text-xl font-extrabold text-[#142b4d]">{value}</p></CardContent></Card>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="grid gap-1.5 text-xs font-semibold text-slate-600">{label}{children}</label>}
