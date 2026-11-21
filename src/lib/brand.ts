export const BRAND = {
  name: "Newton Badminton Club Malang",
  shortName: "Newton BC",
  tagline: "Mabar No Pressure, Malang Semua Teman For Sure!",
  domain: "newtonbadmintonclub.my.id",
  est: "9.9.2026",
  waNumber: "628990496925",
  waDisplay: "+62 899-0496-925",
  waShortLink: "https://bit.ly/4teqmjV",
  instagram: { handle: "@newtonclub09", url: "https://www.instagram.com/newtonclub09" },
  tiktok: { handle: "@pb.newton.mlg", url: "https://www.tiktok.com/@pb.newton.mlg" },
  x: { handle: "@newtonbadminton", url: "https://x.com/newtonbadminton" },
  venue: {
    name: "Galaxy Badminton Arena",
    address: "Jl. Simpang Sulfat Selatan No.5, Kota Malang",
    mapsUrl: "https://maps.app.goo.gl/h9wgTx991t6qWHf39",
  },
} as const;

export const LEVELS = ["Beginner", "Intermediate", "Advance"] as const;
export type Level = (typeof LEVELS)[number];

export function waLink(text: string) {
  return `https://wa.me/${BRAND.waNumber}?text=${encodeURIComponent(text)}`;
}

export function formatRp(value: number) {
  return "Rp " + Number(value || 0).toLocaleString("id-ID");
}

const TZ = "Asia/Jakarta";

export function formatEventDate(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatDayParts(iso: string) {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("id-ID", { day: "2-digit", timeZone: TZ }).format(d);
  const month = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: TZ }).format(d);
  const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: TZ }).format(d);
  return { day, month: month.replace(".", ""), weekday: weekday.replace(".", "") };
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function waRegistrationText(input: {
  eventTitle: string;
  dateLabel: string;
  timeSlots: string;
  price: number;
  name: string;
  level: string;
}) {
  return [
    "Halo Admin Newton BC Malang! 🏸",
    "Saya mau daftar mabar:",
    "",
    `• Event: ${input.eventTitle}`,
    `• Tanggal: ${input.dateLabel}`,
    `• Jam: ${input.timeSlots}`,
    `• Nama: ${input.name || "-"}`,
    `• Level: ${input.level}`,
    `• Pembayaran: QRIS / Transfer (${formatRp(input.price)})`,
    "",
    "Mohon info ketersediaan kuota ya Min. Terima kasih!",
  ].join("\n");
}

/** Bank account shown for manual transfer. null = player asks Admin via WhatsApp. */
export const TRANSFER_ACCOUNT: { bank: string; number: string; holder: string } | null = null;
