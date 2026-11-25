import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { keyFetch, newtonDbConfig } from "./newton-db";

function publicClient() {
  const { url, publishableKey } = newtonDbConfig();
  return createClient<Database>(url, publishableKey, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: { fetch: keyFetch(publishableKey) },
  });
}

export type PublicEvent = {
  id: string;
  title: string;
  event_type: string;
  starts_at: string;
  time_slots: string;
  courts: string[];
  venue: string;
  address: string;
  maps_url: string;
  price: number;
  quota_max: number;
  is_featured: boolean;
  filled: number;
  waitlist: number;
};

export const listEvents = createServerFn({ method: "GET" }).handler(async (): Promise<PublicEvent[]> => {
  const sb = publicClient();
  const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const [{ data: events, error }, { data: quota, error: qErr }] = await Promise.all([
    sb
      .from("events")
      .select("id,title,event_type,starts_at,time_slots,courts,venue,address,maps_url,price,quota_max,is_featured,image_url,image_path")
      .gte("starts_at", since)
      .order("starts_at", { ascending: true }),
    sb.rpc("event_quota"),
  ]);
  if (error) throw new Error(error.message);
  if (qErr) throw new Error(qErr.message);
  const byId = new Map((quota ?? []).map((q) => [q.event_id, q]));
  return (events ?? []).map((e) => ({
    ...e,
    filled: byId.get(e.id)?.filled ?? 0,
    waitlist: byId.get(e.id)?.waitlist ?? 0,
  }));
});

export type PublicProduct = Database["public"]["Tables"]["products"]["Row"];

export const listProducts = createServerFn({ method: "GET" }).handler(async (): Promise<PublicProduct[]> => {
  const sb = publicClient();
  const { data, error } = await sb.from("products").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});
