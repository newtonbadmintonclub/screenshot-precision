import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, ClipboardCheck, Plus, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/newton-client";

type Item = { id:string; name:string; sku:string|null; unit:string; quantity:number };
type LoanItem = { id:string; item_id:string; quantity_borrowed:number; quantity_returned:number; condition_on_return:string|null; return_notes:string; inventory_items:{name:string;unit:string;sku:string|null}|null };
type Loan = { id:string; loan_code:string; borrower_name:string; borrower_type:string; borrower_contact:string; purpose:string; borrowed_at:string; due_at:string|null; status:string; notes:string; inventory_loan_items:LoanItem[] };
type Line = { item_id:string; quantity:string };
const dateFmt=(s:string)=>new Date(s).toLocaleDateString("id-ID",{dateStyle:"medium"});
const statusLabel=(s:string)=>s==="returned"?"Selesai":s==="partial_returned"?"Dikembalikan sebagian":"Dipinjam";

export function InventoryLoansPanel(){
 const qc=useQueryClient();
 const [open,setOpen]=useState(false);
 const [returning,setReturning]=useState<LoanItem|null>(null);
 const [loanId,setLoanId]=useState("");
 const [borrower,setBorrower]=useState({name:"",type:"member",contact:"",purpose:"",due_at:"",notes:""});
 const [lines,setLines]=useState<Line[]>([{item_id:"",quantity:"1"}]);
 const [returnForm,setReturnForm]=useState({quantity:"1",condition:"baik",notes:""});
 const loans=useQuery({queryKey:["inventory-loans"],queryFn:async()=>{
  const {data,error}=await supabase.from("inventory_loans").select("id,loan_code,borrower_name,borrower_type,borrower_contact,purpose,borrowed_at,due_at,status,notes,inventory_loan_items(id,item_id,quantity_borrowed,quantity_returned,condition_on_return,return_notes,inventory_items(name,unit,sku))").order("created_at",{ascending:false}).limit(100);
  if(error)throw error;return (data??[]) as unknown as Loan[];
 }});
 const items=useQuery({queryKey:["admin-inventory-items",false],queryFn:async()=>{
  const {data,error}=await supabase.from("inventory_items").select("id,name,sku,unit,quantity").eq("is_active",true).order("name");
  if(error)throw error;return (data??[]) as Item[];
 }});
 const create=useMutation({mutationFn:async()=>{
  const normalized=lines.map(x=>({item_id:x.item_id,quantity:Math.floor(Number(x.quantity))}));
  if(!borrower.name.trim())throw new Error("Nama peminjam wajib diisi.");
  if(normalized.some(x=>!x.item_id||!Number.isFinite(x.quantity)||x.quantity<=0))throw new Error("Pilih barang dan jumlah yang valid.");
  if(new Set(normalized.map(x=>x.item_id)).size!==normalized.length)throw new Error("Gabungkan barang yang sama dalam satu baris.");
  const {error}=await supabase.rpc("inventory_create_loan",{p_borrower_name:borrower.name.trim(),p_borrower_type:borrower.type,p_borrower_contact:borrower.contact.trim(),p_purpose:borrower.purpose.trim(),p_due_at:borrower.due_at||null,p_notes:borrower.notes.trim(),p_items:normalized});
  if(error)throw error;
 },onSuccess:async()=>{await Promise.all([qc.invalidateQueries({queryKey:["inventory-loans"]}),qc.invalidateQueries({queryKey:["admin-inventory-items"]}),qc.invalidateQueries({queryKey:["admin-inventory-history"]})]);setOpen(false);setBorrower({name:"",type:"member",contact:"",purpose:"",due_at:"",notes:""});setLines([{item_id:"",quantity:"1"}]);}});
 const returnItem=useMutation({mutationFn:async()=>{
  if(!returning)throw new Error("Pilih detail pinjaman.");
  const qty=Math.floor(Number(returnForm.quantity));
  if(!Number.isFinite(qty)||qty<=0)throw new Error("Jumlah pengembalian tidak valid.");
  const {error}=await supabase.rpc("inventory_return_loan_item",{p_loan_item_id:returning.id,p_quantity:qty,p_condition:returnForm.condition,p_notes:returnForm.notes.trim()});
  if(error)throw error;
 },onSuccess:async()=>{await Promise.all([qc.invalidateQueries({queryKey:["inventory-loans"]}),qc.invalidateQueries({queryKey:["admin-inventory-items"]}),qc.invalidateQueries({queryKey:["admin-inventory-history"]})]);setReturning(null);setReturnForm({quantity:"1",condition:"baik",notes:""});}});
 const active=(loans.data??[]).filter(l=>l.status!=="returned").length;
 return <div className="space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-display text-lg font-bold text-[#142b4d]">Peminjaman & Pengembalian</h3><p className="text-sm text-slate-500">Pantau barang yang dipinjam pemain dan pengurus serta kondisi saat dikembalikan.</p></div><Button onClick={()=>setOpen(true)} className="bg-orange-500 text-white"><Plus className="mr-2 h-4 w-4"/>Catat Peminjaman</Button></div>
  <div className="grid gap-3 sm:grid-cols-3"><Metric label="Total Transaksi" value={(loans.data??[]).length}/><Metric label="Masih Dipinjam" value={active}/><Metric label="Selesai" value={(loans.data??[]).filter(l=>l.status==="returned").length}/></div>
  <Card className="rounded-2xl border-slate-200 shadow-sm"><CardHeader><CardTitle className="text-[#142b4d]">Riwayat Peminjaman</CardTitle></CardHeader><CardContent>
   {loans.isLoading?<p className="py-8 text-center text-sm text-slate-500">Memuat data...</p>:loans.isError?<p className="text-sm text-red-600">{loans.error.message}</p>:(loans.data??[]).length===0?<div className="py-10 text-center text-sm text-slate-500"><ClipboardCheck className="mx-auto mb-2 h-8 w-8 text-slate-300"/>Belum ada transaksi peminjaman.</div>:<div className="space-y-3">{loans.data!.map(loan=><div key={loan.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-[#142b4d]">{loan.borrower_name}<span className="ml-2 text-xs font-normal text-slate-500">({loan.borrower_type==="member"?"Pemain":loan.borrower_type==="staff"?"Pengurus":"Lainnya"})</span></p><p className="mt-1 text-xs text-slate-500">{loan.loan_code} • {dateFmt(loan.borrowed_at)}{loan.due_at?" • Batas kembali "+dateFmt(loan.due_at):""}</p>{loan.borrower_contact&&<p className="text-xs text-slate-500">{loan.borrower_contact}</p>}</div><Badge variant="outline" className={loan.status==="returned"?"border-emerald-200 bg-emerald-50 text-emerald-700":loan.status==="partial_returned"?"border-orange-200 bg-orange-50 text-orange-700":"border-blue-200 bg-blue-50 text-blue-700"}>{statusLabel(loan.status)}</Badge></div>
    <div className="mt-3 divide-y divide-slate-100">{loan.inventory_loan_items.map(line=><div key={line.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><div><p className="font-semibold text-slate-700">{line.inventory_items?.name??"Barang"}</p><p className="text-xs text-slate-500">Dipinjam {line.quantity_borrowed} • Kembali {line.quantity_returned} • Sisa {line.quantity_borrowed-line.quantity_returned}</p>{line.condition_on_return&&<p className="text-xs text-slate-500">Kondisi terakhir: {line.condition_on_return.replace("_"," ")}</p>}</div>{line.quantity_returned<line.quantity_borrowed&&<Button size="sm" variant="outline" onClick={()=>{setLoanId(loan.id);setReturning(line);setReturnForm({quantity:String(line.quantity_borrowed-line.quantity_returned),condition:"baik",notes:""});}}><RotateCcw className="mr-1 h-3.5 w-3.5"/>Catat Pengembalian</Button>}</div>)}</div>
    {loan.purpose&&<p className="mt-2 text-xs text-slate-500">Keperluan: {loan.purpose}</p>}</div>)}</div>}
  </CardContent></Card>
  {open&&<Dialog title="Catat Peminjaman Barang" close={()=>setOpen(false)}><form className="space-y-3" onSubmit={e=>{e.preventDefault();create.mutate();}}>
   <div className="grid gap-3 sm:grid-cols-2"><Field label="Nama Peminjam"><input required className="field" value={borrower.name} onChange={e=>setBorrower({...borrower,name:e.target.value})}/></Field><Field label="Jenis Peminjam"><select className="field" value={borrower.type} onChange={e=>setBorrower({...borrower,type:e.target.value})}><option value="member">Pemain</option><option value="staff">Pengurus</option><option value="other">Lainnya</option></select></Field><Field label="Kontak"><input className="field" value={borrower.contact} onChange={e=>setBorrower({...borrower,contact:e.target.value})}/></Field><Field label="Batas Pengembalian"><input type="date" className="field" value={borrower.due_at} onChange={e=>setBorrower({...borrower,due_at:e.target.value})}/></Field></div>
   <Field label="Keperluan"><input className="field" value={borrower.purpose} onChange={e=>setBorrower({...borrower,purpose:e.target.value})} placeholder="Latihan, pertandingan, event..."/></Field>
   <div className="space-y-2"><div className="flex items-center justify-between"><p className="text-sm font-bold text-[#142b4d]">Barang yang Dipinjam</p><Button type="button" size="sm" variant="outline" onClick={()=>setLines([...lines,{item_id:"",quantity:"1"}])}><Plus className="mr-1 h-3 w-3"/>Tambah</Button></div>
    {lines.map((line,i)=><div key={i} className="grid grid-cols-[minmax(0,1fr)_90px] gap-2"><Field label="Barang"><select required className="field" value={line.item_id} onChange={e=>setLines(lines.map((x,j)=>j===i?{...x,item_id:e.target.value}:x))}><option value="">Pilih barang tersedia</option>{(items.data??[]).map(item=><option key={item.id} value={item.id}>{item.name} — stok {item.quantity} {item.unit}</option>)}</select></Field><Field label="Jumlah"><input type="number" min="1" required className="field" value={line.quantity} onChange={e=>setLines(lines.map((x,j)=>j===i?{...x,quantity:e.target.value}:x))}/></Field></div>)}
   </div><Field label="Catatan"><textarea className="field min-h-16" value={borrower.notes} onChange={e=>setBorrower({...borrower,notes:e.target.value})}/></Field>
   {create.isError&&<p className="text-sm text-red-600">{create.error.message}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Batal</Button><Button disabled={create.isPending} className="bg-[#142b4d] text-white">{create.isPending?"Menyimpan...":"Simpan Peminjaman"}</Button></div>
  </form></Dialog>}
  {returning&&<Dialog title="Catat Pengembalian" close={()=>setReturning(null)}><form className="space-y-3" onSubmit={e=>{e.preventDefault();returnItem.mutate();}}><p className="text-sm text-slate-600">Sisa pinjaman: <b>{returning.quantity_borrowed-returning.quantity_returned}</b> unit</p><Field label="Jumlah Dikembalikan"><input required type="number" min="1" max={returning.quantity_borrowed-returning.quantity_returned} className="field" value={returnForm.quantity} onChange={e=>setReturnForm({...returnForm,quantity:e.target.value})}/></Field><Field label="Kondisi Barang"><select className="field" value={returnForm.condition} onChange={e=>setReturnForm({...returnForm,condition:e.target.value})}><option value="baik">Baik</option><option value="perlu_perbaikan">Perlu Perbaikan</option><option value="rusak">Rusak</option></select></Field><Field label="Catatan"><textarea className="field min-h-16" value={returnForm.notes} onChange={e=>setReturnForm({...returnForm,notes:e.target.value})}/></Field>{returnItem.isError&&<p className="text-sm text-red-600">{returnItem.error.message}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setReturning(null)}>Batal</Button><Button disabled={returnItem.isPending} className="bg-[#142b4d] text-white">{returnItem.isPending?"Menyimpan...":"Simpan Pengembalian"}</Button></div></form></Dialog>}
 </div>;
}
function Metric({label,value}:{label:string;value:number}){return <Card className="rounded-2xl border-slate-200 shadow-sm"><CardContent className="p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-extrabold text-[#142b4d]">{value.toLocaleString("id-ID")}</p></CardContent></Card>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="grid gap-1.5 text-xs font-semibold text-slate-600">{label}{children}</label>}
function Dialog({title,children,close}:{title:string;children:React.ReactNode;close:()=>void}){return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><section role="dialog" aria-modal="true" aria-label={title} className="my-8 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h3 className="font-display text-lg font-bold text-[#142b4d]">{title}</h3><Button type="button" size="icon" variant="ghost" onClick={close} aria-label="Tutup">×</Button></div>{children}</section></div>}
