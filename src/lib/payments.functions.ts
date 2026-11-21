import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QrisResult =
  | { state: "confirmed" }
  | { state: "awaiting"; qrString: string; expiresAt: string; amount: number; code: string }
  | { state: "expired" }
  | { state: "unavailable"; message: string };

export const startQrisPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<QrisResult> => {
    const { data: b, error } = await context.supabase
      .from("bookings")
      .select("id,code,amount,status,payment_method,payment_expires_at,qr_string")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!b) throw new Error("Tiket tidak ditemukan");
    if (b.status === "confirmed") return { state: "confirmed" };
    if (b.status !== "awaiting_payment" || b.payment_method !== "qris" || !b.payment_expires_at) {
      throw new Error("Tiket ini tidak menunggu pembayaran QRIS");
    }
    if (new Date(b.payment_expires_at) <= new Date()) return { state: "expired" };
    if (b.qr_string) {
      return { state: "awaiting", qrString: b.qr_string, expiresAt: b.payment_expires_at, amount: b.amount, code: b.code };
    }

    const { createXenditQr, XenditNotConfiguredError } = await import("./xendit.server");
    try {
      const qr = await createXenditQr({ referenceId: b.code, amount: b.amount, expiresAt: b.payment_expires_at });
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: upErr } = await supabaseAdmin
        .from("bookings")
        .update({ xendit_qr_id: qr.id, qr_string: qr.qr_string })
        .eq("id", b.id)
        .eq("status", "awaiting_payment");
      if (upErr) throw new Error(upErr.message);
      return { state: "awaiting", qrString: qr.qr_string, expiresAt: b.payment_expires_at, amount: b.amount, code: b.code };
    } catch (e) {
      if (e instanceof XenditNotConfiguredError) {
        return {
          state: "unavailable",
          message: "Pembayaran QRIS sedang disiapkan. Untuk sementara pilih Transfer Manual atau hubungi Admin.",
        };
      }
      throw e;
    }
  });
