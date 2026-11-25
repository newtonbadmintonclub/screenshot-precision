import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bot, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/newton-client";
import { AiSyncPanel } from "@/components/admin/AiSyncPanel";

export const Route = createFileRoute("/_authenticated/admin/ai-sync/")({
 head:()=>({meta:[{title:"AI Agent & Omnichannel Sync — Newton BC"},{name:"robots",content:"noindex"}]}),
 component:AiSyncPage,
});
function AiSyncPage(){
 const {user,loading}=useAuth();
 const access=useQuery({queryKey:["admin-ai-sync-access",user?.id],enabled:!!user,retry:false,queryFn:async()=>{const {data,error}=await supabase.from("user_roles").select("role").eq("user_id",user!.id);if(error)throw error;return (data??[]).some(r=>r.role==="admin");}});
 if(loading||access.isLoading)return <div className="min-h-screen bg-[#F4F7FA] p-8 text-sm text-slate-500">Memeriksa akses Admin...</div>;
 if(!user||access.data!==true)return <div className="min-h-screen bg-[#F4F7FA] p-8"><div className="mx-auto max-w-xl rounded-2xl bg-white p-6"><h1 className="font-bold text-[#0F2544]">Akses terbatas</h1><p className="mt-2 text-sm text-slate-500">Halaman ini hanya tersedia untuk Admin Newton Badminton Club.</p><Button asChild className="mt-4"><Link to="/admin">Kembali ke Dashboard Admin</Link></Button></div></div>;
 return <div className="min-h-screen bg-[#F4F7FA]"><div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0F2544] text-white"><Bot/></span><div><p className="text-[11px] font-bold uppercase tracking-widest text-[#0E9AA7]">Newton Badminton Club • Admin Hub</p><p className="text-sm font-bold text-[#0F2544]">Pusat Otomatisasi</p></div></div><div className="flex gap-2"><Button variant="outline" asChild className="border-slate-200 bg-white"><Link to="/admin/ai-sync/setup"><Settings2 className="mr-2 h-4 w-4"/>Setup AI & Database</Link></Button><Button variant="outline" asChild className="border-slate-200 bg-white"><Link to="/admin"><ArrowLeft className="mr-2 h-4 w-4"/>Admin Hub</Link></Button></div></div><AiSyncPanel/></div></div>;
}
