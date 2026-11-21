import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-webhook-secret","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
type Setting={jalur_1_active:boolean;jalur_2_active:boolean;jalur_3_active:boolean;anti_loop_active:boolean;send_delay_seconds:number;bot_wa_number:string;trigger_keyword:string;waha_api_url:string;wa_group_id:string;instagram_page_id:string};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Metode tidak didukung"},405);
 const url=Deno.env.get("SUPABASE_URL")!, serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const admin=createClient(url,serviceKey);
 const auth=req.headers.get("Authorization")??"";
 const body=await req.json().catch(()=>({})) as Record<string,any>;
 const source=String(body.source??"webhook");
 const isSimulation=source==="simulation";
 if(isSimulation){
  const token=auth.replace(/^Bearer\s+/i,"");
  const client=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY")??"");
  const {data:{user}}=await client.auth.getUser(token);
  if(!user)return json({error:"Sesi Admin tidak valid"},401);
  const {data:roles}=await admin.from("user_roles").select("role").eq("user_id",user.id);
  if(!(roles??[]).some((r:any)=>r.role==="admin"))return json({error:"Akses Admin diperlukan"},403);
 }else{
  const secret=Deno.env.get("OMNICHANNEL_WEBHOOK_SECRET");
  if(!secret||req.headers.get("x-webhook-secret")!==secret)return json({error:"Webhook tidak terautentikasi"},401);
 }
 const {data:settingsData}=await admin.from("ai_sync_settings").select("*").eq("id","00000000-0000-4000-8000-000000000001").maybeSingle();
 const settings=(settingsData??{}) as Setting;
 const text=String(body.text??body.message?.text??body.body??body.entry?.[0]?.messaging?.[0]?.message?.text??"");
 const sender=String(body.sender??body.from??body.key?.remoteJid??body.message?.from??"");
 const normalized=(v:string)=>v.replace(/\D/g,"").replace(/^0/,"62");
 const channel=body.channel==="instagram"||source==="instagram"?"IG DM":source==="website"?"Website":source==="simulation"?(body.mode==="trigger"?"WA Admin → All":"WA Grup → DB"):"WA Grup → DB";
 const log=async(flow:string,description:string,status:"Sukses"|"Aman"|"Gagal",payload:unknown={})=>{await admin.from("ai_sync_logs").insert({channel_flow:flow,description,status,payload_json:payload});};
 if(settings.anti_loop_active&&settings.bot_wa_number&&normalized(sender)===normalized(settings.bot_wa_number)){
  await log("Anti-Loop","Pesan dari nomor Bot sendiri diabaikan untuk mencegah putaran pesan.","Aman",{sender});
  return json({ok:true,ignored:true,reason:"anti_loop"});
 }
 const trigger=(settings.trigger_keyword||"Pendaftaran Mabar Berhasil").toLowerCase();
 const isTrigger=text.toLowerCase().includes(trigger);
 if(!isSimulation&&channel==="WA Admin → All"&&!settings.jalur_3_active)return json({ok:true,ignored:true,reason:"jalur_3_nonaktif"});
 if(!isSimulation&&channel==="WA Grup → DB"&&!settings.jalur_1_active)return json({ok:true,ignored:true,reason:"jalur_1_nonaktif"});
 if(!isSimulation&&channel==="Website"&&!settings.jalur_2_active)return json({ok:true,ignored:true,reason:"jalur_2_nonaktif"});
 if((channel==="WA Admin → All"||channel==="IG DM")&&!isTrigger&&!isSimulation){await log(channel,"Pesan diterima, tetapi kata kunci trigger tidak ditemukan.","Aman",{sender});return json({ok:true,ignored:true,reason:"trigger_not_found"});}
 const apiKey=Deno.env.get("GEMINI_API_KEY");
 if(!apiKey){await log(channel,"Parser AI belum dikonfigurasi. Tambahkan GEMINI_API_KEY pada Secrets Supabase.","Gagal");return json({error:"GEMINI_API_KEY belum dikonfigurasi"},503);}
 const prompt=channel==="WA Grup → DB"||body.mode==="group"
 ? "Parse teks roster WhatsApp badminton berikut. Kembalikan JSON valid saja dengan schema {event_title:string|null,event_date:string|null,closed:boolean,players:[{position:number,name:string}],waiting_list:[{position:number,name:string}]}. Ambil hanya nama pemain bernomor 1-26, deteksi CLOSED, pisahkan Waiting List. Jangan mengarang data.\n\n"+text
 : "Parse pesan konfirmasi pendaftaran berikut. Kembalikan JSON valid saja dengan schema {trigger_detected:boolean,player_name:string|null,schedule:string|null,whatsapp:string|null}. Jangan mengarang data.\n\n"+text;
 const ai=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key="+encodeURIComponent(apiKey),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",temperature:0.1}})});
 if(!ai.ok){const detail=await ai.text();await log(channel,"Gemini gagal memproses pesan.", "Gagal",{http_status:ai.status});return json({error:"Parser AI gagal",detail:detail.slice(0,500)},502);}
 const aiData=await ai.json();const raw=aiData.candidates?.[0]?.content?.parts?.[0]?.text??"{}";
 let parsed:Record<string,any>;try{parsed=JSON.parse(raw);}catch{await log(channel,"Hasil parser AI bukan JSON yang valid.","Gagal");return json({error:"Hasil parser tidak valid"} ,502);}
 if(channel==="WA Grup → DB"&&Array.isArray(parsed.players))parsed.players=parsed.players.filter((p:any)=>Number(p.position)>=1&&Number(p.position)<=26).slice(0,26);
 const description=channel==="WA Grup → DB"?`Daftar WA Grup berhasil diparsing: ${parsed.players?.length??0} pemain dan ${parsed.waiting_list?.length??0} waiting list. Menunggu pemetaan sesi sebelum perubahan booking.`: `Pesan berhasil diparsing untuk ${parsed.player_name??"Pemain"}; jadwal: ${parsed.schedule??"belum terdeteksi"}.`;
 await log(channel,description,"Sukses",parsed);
 return json({ok:true,parsed,booking_sync:"Ditahan sampai sesi dan identitas booking cocok; data booking terverifikasi tidak diubah.",roster_send:"Belum dijalankan. Hubungkan kredensial WAHA dan pemetaan sesi terlebih dahulu."});
});