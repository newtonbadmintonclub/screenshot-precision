import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatShopifyPrice } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";

export function CartDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const { items, isLoading, isSyncing, updateQuantity, removeItem, getCheckoutUrl, syncCart } =
    useCartStore();
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + Number.parseFloat(item.price.amount) * item.quantity,
    0,
  );
  const currencyCode = items[0]?.price.currencyCode ?? "IDR";

  useEffect(() => {
    if (isOpen) void syncCart();
  }, [isOpen, syncCart]);

  function handleCheckout() {
    const checkoutUrl = getCheckoutUrl();
    if (checkoutUrl) {
      window.open(checkoutUrl, "_blank");
      setIsOpen(false);
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Keranjang belanja">
          <ShoppingCart className="!size-5" />
          {totalItems > 0 && (
            <Badge className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange p-0 px-1 text-[10px] font-bold text-accent-foreground">
              {totalItems > 99 ? "99+" : totalItems}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex h-full w-full flex-col sm:max-w-lg">
        <SheetHeader className="shrink-0">
          <SheetTitle>Keranjang Belanja</SheetTitle>
          <SheetDescription>
            {totalItems === 0 ? "Keranjang belanja Anda masih kosong" : `${totalItems} item di keranjang`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col pt-6">
          {items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Keranjang Anda masih kosong</p>
              </div>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto pr-2">
                <div className="space-y-4">
                  {items.map((item) => {
                    const img = item.product.node.images.edges[0]?.node;
                    const opts = item.selectedOptions
                      .filter((o) => !(o.name === "Title" && o.value === "Default Title"))
                      .map((o) => o.value)
                      .join(" • ");
                    return (
                      <div key={item.variantId} className="flex gap-4 rounded-xl border border-border p-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {img && (
                            <img
                              src={img.url}
                              alt={img.altText || item.product.node.title}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate font-semibold text-navy">{item.product.node.title}</h4>
                          {opts && <p className="text-xs text-muted-foreground">{opts}</p>}
                          <p className="mt-1 font-display text-sm font-bold text-navy">
                            {formatShopifyPrice(item.price)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            aria-label="Hapus item"
                            disabled={isLoading}
                            onClick={() => void removeItem(item.variantId)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              aria-label="Kurangi jumlah"
                              disabled={isLoading}
                              onClick={() => void updateQuantity(item.variantId, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              aria-label="Tambah jumlah"
                              disabled={isLoading}
                              onClick={() => void updateQuantity(item.variantId, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="shrink-0 space-y-4 border-t border-border bg-background pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-navy">Total</span>
                  <span className="font-display text-xl font-extrabold text-navy">
                    {formatShopifyPrice({ amount: String(totalPrice), currencyCode })}
                  </span>
                </div>
                <Button
                  variant="cta"
                  size="lg"
                  className="w-full"
                  onClick={handleCheckout}
                  disabled={items.length === 0 || isLoading || isSyncing}
                >
                  {isLoading || isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4" /> Checkout dengan Shopify
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}