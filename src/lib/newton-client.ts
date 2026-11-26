// Browser + SSR client for the club's own Supabase project (RLS applies).
// Replaces the generated "@/lib/newton-client", which the platform
// points at the old Lovable Cloud instance.
import { createClient } from "@supabase/supabase-js";
import type { NewtonDatabase } from "@/lib/newton-schema";
import { keyFetch, NEWTON_SUPABASE_PUBLISHABLE_KEY, NEWTON_SUPABASE_URL } from "./newton-db";

function create() {
  return createClient<NewtonDatabase>(NEWTON_SUPABASE_URL, NEWTON_SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: keyFetch(NEWTON_SUPABASE_PUBLISHABLE_KEY) },
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

let _client: ReturnType<typeof create> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof create>, {
  get(_, prop, receiver) {
    if (!_client) _client = create();
    return Reflect.get(_client, prop, receiver);
  },
});
