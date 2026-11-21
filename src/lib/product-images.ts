import jersey from "@/assets/product-jersey.webp";
import shuttle from "@/assets/product-shuttle.webp";
import grip from "@/assets/product-grip.webp";
import wrist from "@/assets/product-wrist.webp";

const IMAGES: Record<string, string> = {
  "jersey-official-2026": jersey,
  "shuttlecock-pro-speed-77": shuttle,
  "overgrip-anti-slip": grip,
  "wristband-athletic": wrist,
};

export function productImage(slug: string) {
  return IMAGES[slug] ?? jersey;
}
