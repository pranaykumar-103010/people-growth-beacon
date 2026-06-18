import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/types";

export type AuthState = {
  user: { id: string; email: string } | null;
  email: string | null;
  role: AppRole | null;
  isAdmin: boolean;
  isManagerTier: boolean; // any non-admin role that can export team data
  loading: boolean;
};

export function useAuth(): AuthState {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const apply = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) => {
      if (!active) return;
      if (!session?.user) { setUser(null); setRole(null); setLoading(false); return; }
      setUser({ id: session.user.id, email: session.user.email ?? "" });
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle();
      if (!active) return;
      setRole((data?.role as AppRole) ?? "manager");
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => apply(session));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  return {
    user,
    email: user?.email ?? null,
    role,
    isAdmin: role === "hrbp_admin",
    isManagerTier: role !== null && role !== "hrbp_admin",
    loading,
  };
}
