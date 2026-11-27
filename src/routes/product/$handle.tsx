import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { shopifyProductByHandleQuery } from "@/lib/queries";
import { formatShopifyPrice } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/product/$handle")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.handle} — Club Store Newton BC Malang` },
      { name: "description", content: "Detail produk resmi Newton Badminton Club Malang." },
      { property: "og:title", content: "Club Store — Newton Badminton Club Malang" },
      { property: "og:description", content: "Detail produk dan pemesanan resmi Club Store Newton BC." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(shopifyProductByHandleQuery(params.handle));
  },
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { handle } = Route.useParams();
  const { data: product } = useSuspenseQuery(shopifyProductByHandleQuery(handle));
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);

  const variants = product?.node.variants.edges.map((e) => e.node) ?? [];
  const [selectedVariantId, setSelectedVariantId] = useState<string>(variants[0]?.id ?? "");
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);

  if (!product) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <h1 className="display-title text-3xl text-navy">Produk tidak ditemukan</h1>
        <p className="mt-2 text-sm text-muted-foreground">Produk ini belum tersedia atau sudah dihapus dari toko.</p>
        <Button asChild variant="default" className="mt-6">
          <Link to="/store">
            <ArrowLeft /> Kembali ke Club Store
          </Link>
        </Button>
      </section>
    );
  }

  const { node } = product;
  const images = node.images.edges.map((e) => e.node);
  const activeImage = images[selectedImageIdx] ?? images[0];
  const activeVariant = variants.find((v) => v.id === selectedVariantId) ?? variants[0];
  const showVariants = variants.length > 1 || (variants[0] && variants[0].title !== "Default Title");

  async function handleAddToCart() {
    if (!product || !activeVariant) return;
    const ok = await addItem({
      product,
      variantId: activeVariant.id,
      variantTitle: activeVariant.title,
      price: activeVariant.price,
      quantity: 1,
      selectedOptions: activeVariant.selectedOptions || [],
    });
    if (ok) {
      toast.success(`${node.title} ditambahkan ke keranjang`);
    } else {
      toast.error("Gagal menambahkan ke keranjang. Coba lagi.");
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <Link
        to="/store"
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke Club Store
      </Link>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
            {activeImage ? (
              <img
                src={activeImage.url}
                alt={activeImage.altText || node.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ShoppingBag className="h-12 w-12" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => setSelectedImageIdx(i)}
                  className={cn(
                    "h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-colors",
                    i === selectedImageIdx ? "border-navy" : "border-border opacity-70 hover:opacity-100",
                  )}
                >
                  <img src={img.url} alt={img.altText || node.title} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {node.productType && <p className="eyebrow text-teal">{node.productType}</p>}
          <h1 className="display-title text-3xl text-navy sm:text-4xl">{node.title}</h1>
          <p className="font-display text-2xl font-extrabold text-navy">
            {formatShopifyPrice(activeVariant?.price ?? node.priceRange.minVariantPrice)}
          </p>

          {node.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground sm:text-base">
              {node.description}
            </p>
          )}

          {showVariants && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pilih Varian</p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    disabled={!v.availableForSale}
                    onClick={() => setSelectedVariantId(v.id)}
                    className={cn(
                      "rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors",
                      activeVariant?.id === v.id
                        ? "border-navy bg-navy text-on-dark"
                        : "border-border bg-card text-navy hover:border-navy/50",
                      !v.availableForSale && "cursor-not-allowed opacity-40 line-through",
                    )}
                  >
                    {v.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button
              variant="cta"
              size="xl"
              className="w-full sm:w-auto"
              disabled={isLoading || !activeVariant || !activeVariant.availableForSale}
              onClick={() => void handleAddToCart()}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : !activeVariant?.availableForSale ? (
                "Stok Habis"
              ) : (
                <>
                  <ShoppingBag /> Tambah ke Keranjang
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}