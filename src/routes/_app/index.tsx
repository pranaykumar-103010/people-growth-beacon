import { createFileRoute } from "@tanstack/react-router";
import { Users, AlertTriangle, UserPlus, TrendingUp, Loader2 } from "lucide-react";
import { useEmployees } from "@/hooks/use-employees";
import { useAuth } from "@/hooks/use-auth";
import { RagBadge } from "@/components/Rag";
import { StayConversationButton } from "@/components/StayConversationButton";
import { tenureDays } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_app/")({
  component: CommandCenter,
});

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string | number; sub?: string; tone?: "default" | "warning" | "good" }) {
  const ring = tone === "warning" ? "ring-rag-amber/30" : tone === "good" ? "ring-rag-green/30" : "ring-border";
  return (
    <Card className={`shadow-sm ring-1 ${ring} border-0`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-2 font-display text-3xl text-foreground">{value}</div>
            {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
          </div>
          <div className="size-10 rounded-lg bg-secondary grid place-items-center text-accent">
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CommandCenter() {
  const { email, isAdmin } = useAuth();
  const { data: employees = [], isLoading } = useEmployees();

  const total = employees.length;
  const avgRisk = total ? Math.round(employees.reduce((s, e) => s + e.risk_score, 0) / total) : 0;
  const newJoiners = employees.filter((e) => tenureDays(e.date_joined) < 90).length;
  const atRisk = employees.filter((e) => e.risk_score > 70).sort((a, b) => b.risk_score - a.risk_score);
  const stars = employees.filter((e) => e.nine_box_quadrant === "Star").length;

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="space-y-1">
        <div className="text-xs uppercase tracking-widest text-accent font-medium">
          {isAdmin ? "HRBP Command Center" : "Manager Command Center"}
        </div>
        <h1 className="font-display text-3xl md:text-4xl">Good to see you{email ? `, ${email.split("@")[0]}` : ""}.</h1>
        <p className="text-muted-foreground text-sm">A snapshot of your team's health, risk, and momentum.</p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="size-4 animate-spin" /> Loading your team…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <Kpi icon={Users} label="Total Team Size" value={total} sub={isAdmin ? "across all sub-departments" : "direct reports"} />
            <Kpi icon={TrendingUp} label="Avg Attrition Risk" value={avgRisk} sub={`/ 100`}
              tone={avgRisk >= 60 ? "warning" : avgRisk < 35 ? "good" : "default"} />
            <Kpi icon={UserPlus} label="New Joiners in Induction" value={newJoiners} sub="< 90 days tenure" />
            <Kpi icon={AlertTriangle} label="9-Box Stars" value={stars} sub="High perf · high potential" tone="good" />
          </div>

          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-xl">Attention Required</h2>
              <span className="text-xs text-muted-foreground">{atRisk.length} at risk · score &gt; 70</span>
            </div>
            {atRisk.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
                No one above the 70 risk threshold. Keep the conversations flowing.
              </CardContent></Card>
            ) : (
              <Card><CardContent className="p-0 divide-y divide-border">
                {atRisk.map((e) => (
                  <div key={e.id} className="flex flex-col md:flex-row md:items-center gap-3 p-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="size-10 rounded-full bg-accent/10 text-accent grid place-items-center font-medium flex-shrink-0">
                        {e.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{e.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {e.job_title} · {e.sub_department}
                        </div>
                        {e.risk_drivers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {e.risk_drivers.slice(0, 3).map((d) => (
                              <span key={d} className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{d}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 md:justify-end">
                      <RagBadge score={e.risk_score} />
                      <StayConversationButton employee={e} />
                    </div>
                  </div>
                ))}
              </CardContent></Card>
            )}
          </section>
        </>
      )}
    </div>
  );
}
