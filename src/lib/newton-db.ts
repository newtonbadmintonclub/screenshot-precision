// Server-side connection settings for the club's own Supabase project.
// The build-time VITE_* values (from .env) win over runtime SUPABASE_* env vars,
// so the server talks to the same database the browser uses.
export function newtonDbConfig() {
  const env = typeof process !== "undefined" ? process.env : {};
  const url = import.meta.env["VITE_SUPABASE_URL"] || env["SUPABASE_URL"];
  const publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishableKey) throw new Error("Missing Supabase URL or publishable key");
  return { url: url.replace(/\/+$/, ""), publishableKey };
}

/** Fetch wrapper: new sb_* keys are opaque, not bearer JWTs. */
export function keyFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}
