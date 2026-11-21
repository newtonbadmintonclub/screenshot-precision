// Xendit QRIS helpers. Server-only: calls go through the Lovable connector gateway.
// Not connected yet: set the connector id and its connection-key env var once Xendit is linked.
// Until then createXenditQr throws XenditNotConfiguredError and the UI offers manual transfer.
const XENDIT_CONNECTOR_ID: string | null = null;
const XENDIT_CONNECTION_ENV = "XENDIT_API_KEY";
const GATEWAY_URL = `https://connector-gateway.lovable.dev/${XENDIT_CONNECTOR_ID ?? "xendit"}`;

export class XenditNotConfiguredError extends Error {}

export async function createXenditQr(input: { referenceId: string; amount: number; expiresAt: string }) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env[XENDIT_CONNECTION_ENV];
  if (!XENDIT_CONNECTOR_ID || !lovableKey || !connectionKey) throw new XenditNotConfiguredError("Xendit belum tersambung");

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
