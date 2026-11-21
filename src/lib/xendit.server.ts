// Xendit QRIS helpers. Server-only: calls go through the Lovable connector gateway.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/__XENDIT_CONNECTOR_ID__";

export class XenditNotConfiguredError extends Error {}

export async function createXenditQr(input: { referenceId: string; amount: number; expiresAt: string }) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["__XENDIT_CONNECTION_ENV__"];
  if (!lovableKey || !connectionKey) throw new XenditNotConfiguredError("Xendit belum tersambung");

  const res = await fetch(`${GATEWAY_URL}/qr_codes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
      "api-version": "2022-07-31",
    },
    body: JSON.stringify({
      reference_id: input.referenceId,
      type: "DYNAMIC",
      currency: "IDR",
      amount: input.amount,
      expires_at: input.expiresAt,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Xendit QR request failed [${res.status}]: ${body}`);
    throw new Error(`Gagal membuat QRIS [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { id: string; qr_string: string; status: string };
  return json;
}
