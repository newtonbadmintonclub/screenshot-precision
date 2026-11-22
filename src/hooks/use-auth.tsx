import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/newton-client";

type AuthState = { user: User | null; session: Session | null; loading: boolean };

const AuthContext = createContext<AuthState>({ user: null, session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, session: null, loading: true });

  useEffect(() => {
    let mounted = true;
    let receivedAuthEvent = false;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedAuthEvent = true;
      if (mounted) setState({ user: session?.user ?? null, session, loading: false });
    });

    // getSession is a fallback for initialization only. It must not overwrite a
    // newer SIGNED_IN / SIGNED_OUT event that arrived while it was resolving.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted || receivedAuthEvent) return;
      if (error) console.error("[Auth] Failed to restore session:", error.message);
      setState({ user: session?.user ?? null, session, loading: false });
    }).catch((error: unknown) => {
      if (!mounted || receivedAuthEvent) return;
      console.error("[Auth] Failed to restore session:", error);
      setState({ user: null, session: null, loading: false });
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,whatsapp,level")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUnreadCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications", "unread", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
