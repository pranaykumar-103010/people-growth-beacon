import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/layout/AppShell";
import { isAllowedEmail } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const { user, email, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    if (!isAllowedEmail(email)) {
      supabase.auth.signOut().then(() => navigate({ to: "/login", search: { restricted: "1" } as never }));
    }
  }, [user, email, loading, navigate]);

  if (loading || !user) return null;
  return <AppShell><Outlet /></AppShell>;
}
