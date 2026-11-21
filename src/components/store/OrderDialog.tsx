import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Minus, Plus, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatRp, waLink } from "@/lib/brand";
import { productImage } from "@/lib/product-images";
import type { PublicProduct } from "@/lib/public.functions";
import { cn } from "@/lib/utils";

export function OrderDialog({ product, open, onOpenChange }: { product: PublicProduct | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [qty, setQty] = useState(1);
  const [size, setSize] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderCode, setOrderCode] = useState<string | null>(null);

  useEffect(() => {
    setQty(1);
    setSize(null);
    setNote("");
    setOrderCode(null);
  }, [product?.id, open]);

  if (!product) return null;
  const needsSize = product.sizes.length > 0;
  const total = product.price * qty;
  const waText = `Halo Admin Newton BC! Saya mau pesan:\n\n• Produk: ${product.name}\n${needsSize ? `• Ukuran/Warna: ${size ?? "-"}\n` : ""}• Jumlah: ${qty}\n• Total: ${formatRp(total)}${note.trim() ? `\n• Catatan: ${note.trim().slice(0, 300)}` : ""}\n\nTerima kasih!`;

  async function placeOrder() {
    if (needsSize && !size) {
      toast.error("Pilih ukuran / warna dulu");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("place_order", {
      _product_id: product!.id,
      _quantity: qty,
      _size: size ?? "",
      _note: note.trim().slice(0, 300),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOrderCode((data as unknown as { code: string }).code);
    queryClient.invalidateQueries({ queryKey: ["my-orders"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg font-extrabold text-navy">{product.name}</DialogTitle>
          <DialogDescription>{product.description}</DialogDescription>
        </DialogHeader>
        {orderCode ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-success-soft p-5 text-center">
              <CheckCircle2 className="mx-auto h-9 w-9 text-success" />
              <p className="mt-2 font-display text-lg font-extrabold text-navy">Pesanan {orderCode} diterima</p>
              <p className="text-sm text-muted-foreground">Admin akan menghubungi via WA untuk pembayaran & pengambilan di venue.</p>
            </div>
            <Button asChild variant="whatsapp" className="w-full">
              <a href={waLink(`Halo Admin, saya baru pesan ${orderCode} (${qty}x ${product.name}). Mohon infonya ya!`)} target="_blank" rel="noreferrer">
                <Send /> Konfirmasi ke WA Admin
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-xl bg-muted p-3">
              <img src={productImage(product.slug)} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0">
                <p className="font-display text-xl font-extrabold text-navy">{formatRp(product.price)}</p>
                <p className="text-xs text-muted-foreground">Stok tersedia: {product.stock}</p>
              </div>
            </div>
            {needsSize && (
              <div className="space-y-2">
                <Label>Pilih ukuran / warna</Label>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      aria-pressed={size === s}
                      className={cn(
                        "h-10 min-w-12 rounded-lg border-2 px-3 text-sm font-bold transition-colors",
                        size === s ? "border-teal bg-teal-soft text-teal" : "border-border bg-card text-navy hover:border-teal/40",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Jumlah</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" aria-label="Kurangi" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus /></Button>
                <span className="w-8 text-center font-display text-lg font-extrabold text-navy">{qty}</span>
                <Button type="button" variant="outline" size="icon" aria-label="Tambah" onClick={() => setQty((q) => Math.min(Math.min(20, product.stock), q + 1))}><Plus /></Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order-note">Catatan (opsional)</Label>
              <Textarea id="order-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: nama punggung jersey" rows={2} />
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-xl font-extrabold text-navy">{formatRp(total)}</span>
            </div>
            <div className="grid gap-2">
              {user ? (
                <Button variant="cta" size="lg" onClick={placeOrder} disabled={submitting}>
                  {submitting && <Loader2 className="animate-spin" />} Pesan Sekarang
                </Button>
              ) : (
                <Button asChild variant="cta" size="lg">
                  <Link to="/auth" search={{ redirect: "/store" }}>Masuk untuk Pesan via Website</Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <a href={waLink(waText)} target="_blank" rel="noreferrer"><Send /> Pesan via WhatsApp</a>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
