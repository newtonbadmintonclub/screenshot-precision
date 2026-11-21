import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Atur Password Baru — Newton BC Malang" },
      { name: "description", content: "Buat password baru untuk akun player Newton Badminton Club Malang." },
      { property: "og:title", content: "Atur Password Baru — Newton BC" },
      { property: "og:description", content: "Reset password akun player Newton BC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session || isRecovery) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password minimal 8 karakter");
      return;
    }
    if (password !== confirm) {
      toast.error("Konfirmasi password tidak sama");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password berhasil diganti");
    navigate({ to: "/tiket", replace: true });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
        <KeyRound className="h-8 w-8 text-teal" />
        <h1 className="mt-3 text-2xl font-extrabold text-navy">Atur Password Baru</h1>
        {!ready ? (
          <p className="mt-2 text-sm text-muted-foreground">Buka halaman ini dari link reset di email kamu ya.</p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-pass">Password baru</Label>
              <Input id="new-pass" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pass">Ulangi password</Label>
              <Input id="confirm-pass" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" variant="cta" size="lg" className="w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Simpan Password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
