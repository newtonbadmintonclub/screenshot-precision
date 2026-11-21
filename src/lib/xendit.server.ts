// Direct Xendit QRIS integration. Server-only: never expose XENDIT_SECRET_KEY to the browser.
export class XenditNotConfiguredError extends Error {}

export async function createXenditQr(input: { referenceId: string; amount: number; expiresAt: string }) {
  const secretKey = process.env["XENDIT_SECRET_KEY"];
  if (!secretKey) throw new XenditNotConfiguredError("Xendit belum dikonfigurasi");

  const response = await fetch("https://api.xendit.co/qr_codes", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${secretKey}:`)}`,
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

  if (!response.ok) {
    const body = await response.text();
    console.error(`Xendit QR request failed [${response.status}]: ${body}`);
    throw new Error(`Gagal membuat QRIS [${response.status}]`);
  }

  const json = (await response.json()) as { id: string; qr_string: string; status: string };
  if (!json.id || !json.qr_string) throw new Error("Respons QRIS Xendit tidak lengkap");
  return json;
}
