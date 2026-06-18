import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Users, AlertTriangle, TrendingUp, Sparkles, Download } from "lucide-react";
import { useEmployees } from "@/hooks/use-employees";
import { useAuth } from "@/hooks/use-auth";
import { RagBadge } from "@/components/Rag";
import { tenureDays } from "@/lib/types";
import type { Employee } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { exportEmployeesXlsx } from "@/lib/export";

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

function EmployeeDetail({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  return (
    <Sheet open={!!employee} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6">
        {employee && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="font-display flex items-center gap-2">
                {employee.name}
                <RagBadge score={employee.attrition_risk} />
              </SheetTitle>
              <SheetDescription>{employee.job_title} · {employee.sub_vertical}</SheetDescription>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-3 text-xs mb-4">
              <div><div className="text-muted-foreground">H2 Rating</div><div className="font-medium text-sm">{employee.h2_rating}</div></div>
              <div><div className="text-muted-foreground">Potential</div><div className="font-medium text-sm">{employee.potential_rating}</div></div>
              <div><div className="text-muted-foreground">9-Box</div><div className="font-medium text-sm">{employee.nine_box_quadrant}</div></div>
            </div>
            <div className="space-y-3 text-sm">
              <Block label="Manager" value={employee.manager_email} />
              <Block label="Roll-up Manager" value={employee.rollup_manager_email ?? "—"} />
              <Block label="Function Head" value={employee.function_head_email ?? "—"} />
              <Block label="HRBP Insights" value={employee.hrbp_insights ?? "No qualitative notes yet."} />
              <Block label="Succession · Next Steps" value={employee.succession_notes ?? "Not set."} />
              <Block label="Future Career Path" value={employee.future_career_path ?? "Not set."} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
function Block({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="whitespace-pre-wrap text-sm">{value}</div>
    </div>
  );
}

function CommandCenter() {
  const { email, role, isAdmin } = useAuth();
  const { data: employees = [], isLoading } = useEmployees();
  const [picked, setPicked] = useState<Employee | null>(null);

  const total = employees.length;
  const avgRisk = total ? Math.round(employees.reduce((s, e) => s + e.attrition_risk, 0) / total) : 0;
  const newJoiners = employees.filter((e) => tenureDays(e.joining_date) < 365).length;
  const atRisk = useMemo(
    () => employees.filter((e) => e.attrition_risk >= 60).sort((a, b) => b.attrition_risk - a.attrition_risk),
    [employees],
  );
  const stars = employees.filter((e) => e.nine_box_quadrant === "Star").length;

  const tier = isAdmin ? "HRBP Command Center"
    : role === "function_head" ? "Function Head Command Center"
    : role === "rollup_manager" ? "Roll-up Manager Command Center"
    : "Manager Command Center";

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-widest text-accent font-medium">{tier}</div>
          <h1 className="font-display text-3xl md:text-4xl">Good to see you{email ? `, ${email.split("@")[0]}` : ""}.</h1>
          <p className="text-muted-foreground text-sm">A snapshot of your team's health, risk, and momentum.</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportEmployeesXlsx(employees, `talent-iq-${role ?? "team"}`)}>
          <Download className="size-4" /> Export Team Data
        </Button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi icon={Users} label="Visible Team Size" value={total} sub={isAdmin ? "across the org" : "in your span"} />
        <Kpi icon={TrendingUp} label="Avg Attrition Risk" value={avgRisk} sub="/ 100"
          tone={avgRisk >= 60 ? "warning" : avgRisk < 35 ? "good" : "default"} />
        <Kpi icon={Sparkles} label="New Joiners" value={newJoiners} sub="< 12 months tenure" />
        <Kpi icon={AlertTriangle} label="9-Box Stars" value={stars} sub="High perf · high potential" tone="good" />
      </div>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-xl">Attention Required</h2>
          <span className="text-xs text-muted-foreground">{atRisk.length} at risk · score ≥ 60</span>
        </div>
        {isLoading ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading team…</CardContent></Card>
        ) : atRisk.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            No one above the 60 risk threshold. Keep the conversations flowing.
          </CardContent></Card>
        ) : (
          <Card><CardContent className="p-0 divide-y divide-border">
            {atRisk.map((e) => (
              <button key={e.emp_id} onClick={() => setPicked(e)} className="w-full text-left flex items-center gap-3 p-4 hover:bg-secondary/50 transition">
                <div className="size-10 rounded-full bg-accent/10 text-accent grid place-items-center font-medium flex-shrink-0">
                  {e.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{e.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{e.job_title} · {e.sub_vertical}</div>
                </div>
                <RagBadge score={e.attrition_risk} />
              </button>
            ))}
          </CardContent></Card>
        )}
      </section>

      <EmployeeDetail employee={picked} onClose={() => setPicked(null)} />
    </div>
  );
}
