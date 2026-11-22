// Connection settings for the club's own Supabase project (publishable values — safe to commit).
// Pinned here on purpose: the preview server rewrites VITE_SUPABASE_* to the old
// Lovable Cloud instance, and server code must hit the same database as the browser.
export const NEWTON_SUPABASE_URL = "https://urijsqkxagpmxxmfhwcv.supabase.co";
export const NEWTON_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_OfIkpPT2lefJq5wZRsVfKg_7jYDGi9M";

export function newtonDbConfig() {
  return { url: NEWTON_SUPABASE_URL, publishableKey: NEWTON_SUPABASE_PUBLISHABLE_KEY };
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
