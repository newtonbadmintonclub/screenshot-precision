import { describe, expect, it } from "vitest";
import { canRequestChange, holdsSlot, quotaState } from "@/lib/booking-status";
import { safeRedirect } from "@/lib/safe-redirect";
import { formatRp, waLink } from "@/lib/brand";

describe("quota", () => {
  it("26 of 26 players is full and offers no slots", () => {
    expect(quotaState(26, 26)).toMatchObject({ isFull: true, remaining: 0, pct: 100 });
  });
  it("18 of 26 players leaves 8 slots", () => {
    expect(quotaState(18, 26)).toMatchObject({ isFull: false, remaining: 8 });
  });
});

describe("slot holds", () => {
  const now = new Date("2026-11-21T10:00:00Z");
  it("an unpaid QRIS booking holds a slot only until it expires", () => {
    expect(holdsSlot("awaiting_payment", "2026-11-21T10:10:00Z", now)).toBe(true);
    expect(holdsSlot("awaiting_payment", "2026-11-21T09:59:00Z", now)).toBe(false);
  });
  it("waiting list and cancelled bookings never hold a slot", () => {
    expect(holdsSlot("waiting_list", null, now)).toBe(false);
    expect(holdsSlot("cancelled", null, now)).toBe(false);
  });
});

describe("cancel & swap", () => {
  it("a waiting-list spot can be cancelled but not passed to another player", () => {
    expect(canRequestChange("waiting_list")).toEqual({ cancel: true, swap: false });
  });
  it("a confirmed ticket can be cancelled or swapped", () => {
    expect(canRequestChange("confirmed")).toEqual({ cancel: true, swap: true });
  });
  it("a ticket with a request in progress cannot get another", () => {
    expect(canRequestChange("cancel_requested")).toEqual({ cancel: false, swap: false });
  });
});

describe("contact & redirects", () => {
  it("WhatsApp links go to the admin number +62 899-0496-925", () => {
    expect(waLink("hi")).toBe("https://wa.me/628990496925?text=hi");
  });
  it("session price shows as Rp 20.000", () => {
    expect(formatRp(20000)).toBe("Rp 20.000");
  });
  it("sign-in never redirects off-site", () => {
    expect(safeRedirect("//evil.com")).toBe("/tiket");
    expect(safeRedirect("https://evil.com")).toBe("/tiket");
    expect(safeRedirect("/jadwal")).toBe("/jadwal");
  });
});
