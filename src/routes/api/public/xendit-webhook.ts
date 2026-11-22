import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  event: z.string(),
  data: z.object({
    qr_id: z.string().min(1).max(100),
    reference_id: z.string().min(1).max(100),
    status: z.string(),
    amount: z.number().nonnegative(),
  }),
});

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/xendit-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["XENDIT_CALLBACK_TOKEN"];
        const token = request.headers.get("x-callback-token") ?? "";
        if (!expected || !safeEqual(token, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let parsed;
        try {
          parsed = payloadSchema.safeParse(await request.json());
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!parsed.success) return new Response("Ignored", { status: 200 });

        const { event, data } = parsed.data;
        if (event !== "qr.payment" || data.status !== "SUCCEEDED") {
          return new Response("Ignored", { status: 200 });
        }

        const { newtonAdmin } = await import("@/lib/newton-admin.server");
        const { error } = await newtonAdmin().rpc("confirm_qris_payment", {
          _qr_id: data.qr_id,
          _reference: data.reference_id,
          _amount: Math.round(data.amount),
        });
        if (error) {
          console.error("confirm_qris_payment failed", error.message);
          return new Response("Not processed", { status: 422 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
