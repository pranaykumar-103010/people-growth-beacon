import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { isAllowedEmail } from "@/lib/types";

type Search = { restricted?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    restricted: typeof s.restricted === "string" ? s.restricted : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, email } = useAuth();
  const { restricted } = Route.useSearch();
  const [blocked, setBlocked] = useState<string | null>(restricted ? "Access Restricted. Please log in using your official FieldAssist or Flick2Know email address." : null);
  const [busy, setBusy] = useState(false);

  // Domain wall — if a session exists but the email is not allowed, sign out
  useEffect(() => {
    if (!user) return;
    if (!isAllowedEmail(email)) {
      supabase.auth.signOut().then(() => {
        setBlocked("Access Restricted. Please log in using your official FieldAssist or Flick2Know email address.");
      });
    } else {
      navigate({ to: "/" });
    }
  }, [user, email, navigate]);

  const signInGoogle = async () => {
    setBusy(true);
    try {
      const res = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (res.error) {
        toast.error(res.error.message ?? "Sign-in failed");
        setBusy(false);
        return;
      }
      if (res.redirected) return; // browser is navigating to Google
      // Token returned inline — domain check will run via effect above
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex bg-sidebar text-sidebar-foreground p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-sidebar-primary grid place-items-center"><Sparkles className="size-5" /></div>
          <div>
            <div className="font-display font-semibold text-lg">Talent IQ</div>
            <div className="text-xs uppercase tracking-widest text-sidebar-foreground/60">Field Assist · Tech HRBP</div>
          </div>
        </div>
        <div>
          <h1 className="font-display text-4xl leading-tight">Talent & Retention Intelligence for managers on the move.</h1>
          <p className="mt-4 text-sidebar-foreground/70 max-w-md">
            Spot attrition risk early. Coach with stay conversations. Turn 1-on-1 notes into real signal.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-sidebar-foreground/70">
          <ShieldCheck className="size-3.5" />
          Restricted to <code className="text-sidebar-foreground">@flick2know.com</code> and <code className="text-sidebar-foreground">@fieldassist.in</code>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="font-display text-2xl">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">Use your official corporate Google account.</p>
          </div>

          {blocked && (
            <div className="flex items-start gap-2 rounded-lg border border-rag-red/30 bg-rag-red/10 text-rag-red p-3 text-sm">
              <AlertTriangle className="size-4 mt-0.5 flex-shrink-0" />
              <span>{blocked}</span>
            </div>
          )}

          <Button onClick={signInGoogle} disabled={busy} size="lg" className="w-full gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : (
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path fill="currentColor" d="M21.35 11.1H12v2.92h5.34c-.23 1.5-1.7 4.4-5.34 4.4-3.2 0-5.82-2.65-5.82-5.92S8.8 6.58 12 6.58c1.82 0 3.04.78 3.74 1.45l2.55-2.46C16.66 3.99 14.55 3 12 3 6.98 3 3 6.98 3 12s3.98 9 9 9c5.2 0 8.62-3.66 8.62-8.8 0-.6-.07-1.05-.17-1.5z"/>
              </svg>
            )}
            Continue with Google
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By signing in you agree to internal HRBP data handling policies.
          </p>
        </div>
      </div>
    </div>
  );
}
