// Verifies the caller's session against the club's own Supabase project and
// gives the handler an RLS-scoped client acting as that user.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { keyFetch, newtonDbConfig } from "./newton-db";

export const requireNewtonAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { url, publishableKey } = newtonDbConfig();
  const authHeader = getRequest()?.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || token.split(".").length !== 3) throw new Error("Unauthorized: Invalid token");

  const supabase = createClient<Database>(url, publishableKey, {
    global: { fetch: keyFetch(publishableKey), headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Unauthorized: Invalid token");

  return next({ context: { supabase, userId: data.claims.sub, claims: data.claims } });
});
