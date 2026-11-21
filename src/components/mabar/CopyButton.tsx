import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";

export function CopyButton({ text, label = "Salin", toastLabel, ...props }: { text: string; label?: string; toastLabel?: string } & ButtonProps) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      {...props}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          toast.success(`${toastLabel ?? "Teks"} disalin`);
          setTimeout(() => setDone(false), 1600);
        } catch {
          toast.error("Gagal menyalin, salin manual ya");
        }
      }}
    >
      {done ? <Check /> : <Copy />} {done ? "Tersalin" : label}
    </Button>
  );
}
