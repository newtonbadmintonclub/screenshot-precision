// Sends the signed-in player's token with every server function call.
import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./newton-client";

export const attachNewtonAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});
