import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderDialog } from "./OrderDialog";
import { formatRp } from "@/lib/brand";
import { productImage } from "@/lib/product-images";
import type { PublicProduct } from "@/lib/public.functions";

export function ProductGrid({ products }: { products: PublicProduct[] }) {
  const [selected, setSelected] = useState<PublicProduct | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {products.map((p) => (
          <article key={p.id} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-lift">
            <div className="relative aspect-square overflow-hidden bg-muted">
              <img
                src={productImage(p.slug)}
                alt={p.name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {p.badge && (
                <span className="eyebrow absolute left-2.5 top-2.5 rounded-full bg-navy px-2 py-1 !text-[9px] text-on-dark">{p.badge}</span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
              <p className="eyebrow !text-[9px] text-teal">{p.category}</p>
              <h3 className="text-sm font-bold leading-snug text-navy sm:text-base">{p.name}</h3>
              <p className="mt-auto font-display text-lg font-extrabold text-navy">{formatRp(p.price)}</p>
              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={() => {
                  setSelected(p);
                  setOpen(true);
                }}
              >
                <ShoppingBag /> Beli / Pesan
              </Button>
            </div>
          </article>
        ))}
      </div>
      <OrderDialog product={selected} open={open} onOpenChange={setOpen} />
    </>
  );
}
