export type BookingStatus =
  | "awaiting_payment"
  | "confirmed"
  | "pending_verification"
  | "waiting_list"
  | "cancel_requested"
  | "swap_requested"
  | "cancelled";

export const STATUS_META: Record<BookingStatus, { label: string; tone: "success" | "warning" | "teal" | "orange" | "muted" }> = {
  awaiting_payment: { label: "Menunggu Pembayaran", tone: "orange" },
  confirmed: { label: "Terkonfirmasi", tone: "success" },
  pending_verification: { label: "Menunggu Verifikasi", tone: "warning" },
  waiting_list: { label: "Waiting List", tone: "teal" },
  cancel_requested: { label: "Cancel Diajukan", tone: "muted" },
  swap_requested: { label: "Oper Slot Diajukan", tone: "muted" },
  cancelled: { label: "Dibatalkan", tone: "muted" },
};

/** Statuses that occupy a court slot (unpaid QRIS holds count only until they expire). */
export function holdsSlot(status: BookingStatus, paymentExpiresAt: string | null, now = new Date()) {
  if (status === "awaiting_payment") {
    return paymentExpiresAt !== null && new Date(paymentExpiresAt) > now;
  }
  return ["confirmed", "pending_verification", "cancel_requested", "swap_requested"].includes(status);
}

/** A player may ask for cancel/refund or a swap only on settled tickets. */
export function canRequestChange(status: BookingStatus) {
  return {
    cancel: ["confirmed", "pending_verification", "waiting_list", "awaiting_payment"].includes(status),
    swap: ["confirmed", "pending_verification"].includes(status),
  };
}

export function quotaState(filled: number, quotaMax: number) {
  const pct = quotaMax > 0 ? Math.min(100, Math.round((filled / quotaMax) * 100)) : 0;
  const isFull = filled >= quotaMax;
  const remaining = Math.max(0, quotaMax - filled);
  return { pct, isFull, remaining, almostFull: !isFull && remaining <= 4 };
}
