import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Truck } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { ProductGrid } from "@/components/store/ProductGrid";
import { productsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/store")({
  head: () => ({
    meta: [
      { title: "Club Store — Jersey & Shuttlecock Newton BC Malang" },
      { name: "description", content: "Jersey official, shuttlecock slop, overgrip, dan wristband Newton Badminton Club Malang. Pesan online, ambil di venue." },
      { property: "og:title", content: "Club Store — Newton Badminton Club Malang" },
      { property: "og:description", content: "Merchandise & gear resmi Newton BC: jersey Dry-Fit, shuttlecock, grip, wristband." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(productsQuery());
  },
  component: StorePage,
});

function StorePage() {
  const { data: products } = useSuspenseQuery(productsQuery());
  const categories = ["Semua", ...Array.from(new Set(products.map((p) => p.category)))];
  const [cat, setCat] = useState("Semua");
  const shown = cat === "Semua" ? products : products.filter((p) => p.category === cat);
  return (
    <>
      <PageHero eyebrow="Official Merch & Gear" title="Club Store">
        Gear andalan member Newton BC. Pesan lewat website atau WhatsApp, ambil langsung saat mabar.
      </PageHero>
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Kategori produk">
          {categories.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={cat === c}
              onClick={() => setCat(c)}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors",
                cat === c ? "bg-navy text-on-dark" : "bg-card text-muted-foreground ring-1 ring-border hover:text-navy",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <ProductGrid products={shown} />
        <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Truck className="h-4 w-4 text-teal" /> Pengambilan di Galaxy Badminton Arena saat jadwal mabar, atau atur pengiriman dengan Admin.
        </p>
      </section>
    </>
  );
}
