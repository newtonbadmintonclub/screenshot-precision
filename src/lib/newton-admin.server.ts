// Service-role client for the club's own Supabase project. Bypasses RLS — server only.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { keyFetch, newtonDbConfig } from "./newton-db";

export function newtonAdmin() {
  const { url } = newtonDbConfig();
  const key = process.env["NEWTON_SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("NEWTON_SUPABASE_SERVICE_ROLE_KEY belum diatur");
  return createClient<Database>(url, key, {
    global: { fetch: keyFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}
