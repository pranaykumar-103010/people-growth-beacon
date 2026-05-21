import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { promoteToAdmin } from "@/lib/roles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const DEMO_MANAGERS = [
  { email: "priya@fieldassist.com", team: "Engineering (8 reports)" },
  { email: "rahul@fieldassist.com", team: "Data (7 reports)" },
  { email: "anjali@fieldassist.com", team: "Platform (9 reports)" },
];

function LoginPage() {
  const navigate = useNavigate();
  const promote = useServerFn(promoteToAdmin);
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("priya@fieldassist.com");
  const [password, setPassword] = useState("Demo1234!");
  const [adminCode, setAdminCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: email.split("@")[0] } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      if (adminCode) {
        try { await promote({ data: { accessCode: adminCode } }); toast.success("HRBP Admin access granted"); }
        catch (e) { toast.error((e as Error).message); }
      }
      toast.success(mode === "signup" ? "Account created" : "Welcome back");
      navigate({ to: "/" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoading(false); }
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
            Spot attrition risk early. Coach with AI-assisted stay conversations. Turn 1-on-1 notes into real signal.
          </p>
        </div>
        <div className="space-y-2 text-sm text-sidebar-foreground/70">
          <div className="font-medium text-sidebar-foreground">Demo manager accounts</div>
          {DEMO_MANAGERS.map((d) => (
            <button key={d.email} onClick={() => setEmail(d.email)}
              className="block text-left hover:text-sidebar-primary-foreground">
              <code className="text-xs">{d.email}</code> <span className="text-sidebar-foreground/50">— {d.team}</span>
            </button>
          ))}
          <div className="pt-2 text-xs flex items-center gap-1.5"><ShieldCheck className="size-3.5" />Use admin code <code>HRBP-DEMO-2026</code> to see all teams.</div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="font-display text-2xl">{mode === "signup" ? "Create your account" : "Sign in"}</h2>
            <p className="text-sm text-muted-foreground mt-1">Use a demo manager email to see scoped data.</p>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>HRBP Admin code <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={adminCode} onChange={(e) => setAdminCode(e.target.value)} placeholder="HRBP-DEMO-2026" />
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</Button>
          <button type="button" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="text-sm text-muted-foreground hover:text-foreground w-full text-center">
            {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </button>
          <p className="text-xs text-muted-foreground text-center">
            <Link to="/" className="hover:underline">← Back</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
