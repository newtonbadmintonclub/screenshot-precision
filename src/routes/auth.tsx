import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logoUrl } from "@/components/site/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BRAND, LEVELS, type Level } from "@/lib/brand";
import { safeRedirect } from "@/lib/safe-redirect";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s["redirect"] === "string" ? { redirect: s["redirect"] } : {},
  head: () => ({
    meta: [
      { title: "Masuk / Daftar — Newton Badminton Club Malang" },
      { name: "description", content: "Masuk atau buat akun player Newton BC untuk daftar mabar, bayar QRIS, dan pantau E-Ticket." },
      { property: "og:title", content: "Masuk ke Portal Player Newton BC" },
      { property: "og:description", content: "Daftar mabar online, E-Ticket, dan notifikasi status booking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Nama minimal 2 huruf").max(80),
  whatsapp: z.string().trim().regex(/^[0-9+ -]{8,20}$/, "Nomor WhatsApp tidak valid"),
  email: z.string().trim().email("Email tidak valid").max(255),
  password: z.string().min(8, "Password minimal 8 karakter").max(72),
});

function GoogleLogo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" className="!size-[18px]">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

function AuthPage() {
  const search = Route.useSearch();
  const target = safeRedirect(search.redirect);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"login" | "register" | "forgot">("login");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [level, setLevel] = useState<Level>("Intermediate");

  useEffect(() => {
    if (!loading && user) navigate({ to: target, replace: true });
  }, [user, loading, target, navigate]);

  async function oauth() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth?redirect=${encodeURIComponent(target)}`,
      },
    });
    if (error) {
      toast.error(error.message || "Gagal masuk dengan Google. Coba lagi ya.");
      setBusy(false);
    }
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) toast.error(error.message === "Invalid login credentials" ? "Email atau password salah" : error.message);
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signUpSchema.safeParse({ fullName, whatsapp, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Data belum lengkap");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth?redirect=${encodeURIComponent(target)}`,
        data: { full_name: parsed.data.fullName, whatsapp: parsed.data.whatsapp, level },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) setSentTo(parsed.data.email);
  }

  async function forgot(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) {
      toast.error("Masukkan email yang valid");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) toast.error(error.message);
    else setSentTo(parsed.data);
  }

  return (
    <div className="surface-court relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="stripe-accent pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="relative mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-16">
        <div className="hidden space-y-5 lg:block">
          <img src={logoUrl} alt="" className="h-28 w-28 object-contain" />
          <h1 className="display-title text-5xl">Portal Player</h1>
          <p className="max-w-sm text-on-dark-muted">Daftar mabar sekali klik, bayar QRIS instan, simpan E-Ticket, dan dapat kabar waiting list langsung di akunmu.</p>
          <p className="font-display text-lg font-bold text-orange">“{BRAND.tagline}”</p>
        </div>

        <div className="rounded-3xl bg-card p-6 text-card-foreground shadow-lift sm:p-8">
          {sentTo ? (
            <div className="space-y-3 py-6 text-center">
              <MailCheck className="mx-auto h-10 w-10 text-teal" />
              <h2 className="text-xl font-extrabold text-navy">Cek email kamu</h2>
              <p className="text-sm text-muted-foreground">
                Kami kirim link ke <span className="font-semibold text-navy">{sentTo}</span>. {tab === "forgot" ? "Klik link untuk atur password baru." : "Klik link konfirmasi untuk mengaktifkan akun."}
              </p>
              <Button variant="outline" onClick={() => { setSentTo(null); setTab("login"); }}>Kembali ke Masuk</Button>
            </div>
          ) : (
            <>
              <div className="mb-5 lg:hidden">
                <h1 className="text-2xl font-extrabold text-navy">Portal Player</h1>
                <p className="text-sm text-muted-foreground">Masuk untuk daftar mabar & lihat E-Ticket.</p>
              </div>
              <div className="grid gap-2">
                <Button type="button" variant="outline" size="lg" onClick={() => oauth()} disabled={busy}>
                  <GoogleLogo /> Continue with Google
                </Button>
              </div>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> atau pakai email <span className="h-px flex-1 bg-border" />
              </div>
              <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                {tab !== "forgot" && (
                  <TabsList className="mb-4 grid w-full grid-cols-2">
                    <TabsTrigger value="login">Masuk</TabsTrigger>
                    <TabsTrigger value="register">Daftar Akun</TabsTrigger>
                  </TabsList>
                )}
                <TabsContent value="login">
                  <form onSubmit={signIn} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="login-email">Email</Label>
                      <Input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password">Password</Label>
                        <button type="button" className="text-xs font-semibold text-teal hover:underline" onClick={() => setTab("forgot")}>Lupa password?</button>
                      </div>
                      <Input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <Button type="submit" variant="cta" size="lg" className="w-full" disabled={busy}>
                      {busy && <Loader2 className="animate-spin" />} Masuk
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="register">
                  <form onSubmit={signUp} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-fullname">Nama Lengkap</Label>
                      <Input id="reg-fullname" autoComplete="name" required maxLength={80} value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="reg-whatsapp">No. WhatsApp</Label>
                        <Input id="reg-whatsapp" inputMode="tel" placeholder="08xxxxxxxxxx" required maxLength={20} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Level</Label>
                        <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
                          <SelectTrigger className="w-[136px]" aria-label="Level main"><SelectValue /></SelectTrigger>
                          <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-email">Email</Label>
                      <Input id="reg-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-password">Password (min. 8 karakter)</Label>
                      <Input id="reg-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <Button type="submit" variant="cta" size="lg" className="w-full" disabled={busy}>
                      {busy && <Loader2 className="animate-spin" />} Buat Akun
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="forgot">
                  <form onSubmit={forgot} className="space-y-3">
                    <h2 className="text-lg font-extrabold text-navy">Reset password</h2>
                    <p className="text-sm text-muted-foreground">Masukkan email akunmu, kami kirim link untuk membuat password baru.</p>
                    <div className="space-y-1.5">
                      <Label htmlFor="forgot-email">Email</Label>
                      <Input id="forgot-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <Button type="submit" variant="cta" size="lg" className="w-full" disabled={busy}>
                      {busy && <Loader2 className="animate-spin" />} Kirim Link Reset
                    </Button>
                    <Button type="button" variant="ghost" className="w-full" onClick={() => setTab("login")}>Kembali</Button>
                  </form>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
