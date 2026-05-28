import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { mockStore } from "@/lib/mock-store";
import { useAuth } from "@/hooks/use-auth";
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
  const { user } = useAuth();
  const [email, setEmail] = useState("admin@company.com");
  const [password, setPassword] = useState("password123");
  const [asAdmin, setAsAdmin] = useState(true);

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || password.length < 4) {
      toast.error("Enter any email and a 4+ character password");
      return;
    }
    mockStore.signIn(email, asAdmin);
    toast.success(`Welcome, ${email.split("@")[0]}`);
    navigate({ to: "/" });
  };

  const guest = () => {
    mockStore.signIn("guest@fieldassist.com", true);
    navigate({ to: "/" });
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
        <div className="space-y-2 text-sm text-sidebar-foreground/70">
          <div className="font-medium text-sidebar-foreground">Pilot demo · click to use a manager view</div>
          {DEMO_MANAGERS.map((d) => (
            <button key={d.email} onClick={() => { setEmail(d.email); setAsAdmin(false); }}
              className="block text-left hover:text-sidebar-primary-foreground">
              <code className="text-xs">{d.email}</code> <span className="text-sidebar-foreground/50">— {d.team}</span>
            </button>
          ))}
          <div className="pt-2 text-xs flex items-center gap-1.5"><ShieldCheck className="size-3.5" />Toggle "HRBP Admin" to see all teams.</div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="font-display text-2xl">Sign in to the pilot</h2>
            <p className="text-sm text-muted-foreground mt-1">Any email + password works. No backend, fully local.</p>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" required minLength={4} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm select-none">
            <input type="checkbox" checked={asAdmin} onChange={(e) => setAsAdmin(e.target.checked)} className="size-4 accent-primary" />
            Sign in as HRBP Admin (see all teams)
          </label>
          <Button type="submit" className="w-full">Sign in</Button>
          <Button type="button" variant="outline" onClick={guest} className="w-full gap-1.5">
            Bypass login · Guest access <ArrowRight className="size-3.5" />
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            <Link to="/" className="hover:underline">← Back</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
