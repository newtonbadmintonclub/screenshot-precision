/** Only same-origin relative paths are allowed as post-login destinations. */
export function safeRedirect(value: unknown, fallback = "/tiket") {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.startsWith("/auth")) return fallback;
  return value;
}
