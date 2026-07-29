import { Link, useRouter } from "@tanstack/react-router";
import { LayoutDashboard, Grid3x3, AlertTriangle, LogOut, Sparkles, ShieldCheck, Calculator, Settings2, Target, Crown, UserPlus, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { DataHealthBadge } from "@/components/DataHealthBadge";
import { AiCopilotLauncher } from "@/components/AiCopilot";

const BASE_NAV = [
  { to: "/", label: "Command Center", icon: LayoutDashboard },
  { to: "/talent-matrix", label: "Talent Segments", icon: Grid3x3 },
  { to: "/leadership-pipeline", label: "Leadership Pipeline", icon: Crown },
  { to: "/high-performers", label: "High Performers", icon: Trophy },
  { to: "/new-joiners", label: "New Joiners", icon: UserPlus },
  { to: "/attrition", label: "Attrition Radar", icon: AlertTriangle },
  { to: "/risk-methodology", label: "Risk Methodology", icon: Calculator },
] as const;


const ROLE_LABEL: Record<string, string> = {
  hrbp_admin: "HRBP Admin",
  function_head: "Function Head",
  rollup_manager: "Roll-up Manager",
  manager: "Manager",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { email, role, isAdmin } = useAuth();
  const router = useRouter();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/login" });
  };

  const nav = isAdmin
    ? [...BASE_NAV, { to: "/admin" as const, label: "Admin", icon: Settings2 }]
    : BASE_NAV;

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground p-5 gap-1">
        <div className="flex items-center gap-2 px-2 py-3 mb-4">
          <div className="size-9 rounded-lg bg-sidebar-primary grid place-items-center">
            <Sparkles className="size-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-semibold leading-tight">Talent IQ</div>
            <div className="text-[11px] uppercase tracking-wider text-sidebar-foreground/60">Field Assist · Tech</div>
          </div>
        </div>
        {nav.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition"
            activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary" }}
            activeOptions={{ exact: to === "/" }}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
        <div className="mt-auto pt-4 border-t border-sidebar-border">
          <div className="px-3 pb-2"><DataHealthBadge /></div>
          <div className="px-3 py-2 text-xs text-sidebar-foreground/60 flex items-center gap-1.5">
            {isAdmin ? <ShieldCheck className="size-3.5" /> : null}
            {role ? ROLE_LABEL[role] ?? role : "—"}
          </div>
          <div className="px-3 text-xs text-sidebar-foreground/70 truncate">{email}</div>
          <button
            onClick={signOut}
            className="mt-2 flex items-center gap-2 px-3 py-2 w-full rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent transition"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 inset-x-0 bg-sidebar text-sidebar-foreground z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5" />
          <span className="font-display font-semibold">Talent IQ</span>
        </div>
        <button onClick={signOut} aria-label="Sign out"><LogOut className="size-5" /></button>
      </div>

      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <div className="md:hidden border-b border-border overflow-x-auto">
          <div className="flex gap-1 p-2">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap text-muted-foreground hover:bg-secondary")}
                activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}
                activeOptions={{ exact: to === "/" }}
              >
                <Icon className="size-3.5" /> {label}
              </Link>
            ))}
          </div>
        </div>
        {children}
      </main>
      <AiCopilotLauncher />
    </div>
  );
}

