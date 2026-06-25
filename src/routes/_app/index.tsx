import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Users, AlertTriangle, TrendingUp, Sparkles, Download, Crown, Search, RefreshCw, Brain, Target, Activity } from "lucide-react";
import { useEmployees } from "@/hooks/use-employees";
import { useAuth } from "@/hooks/use-auth";
import { RagBadge } from "@/components/Rag";
import { tenureDays, LEADERSHIP_LABEL } from "@/lib/types";
import type { Employee } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { exportEmployeesXlsx } from "@/lib/export";
import { generateEmployeeInsight } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/")({ component: CommandCenter });

function ExecKpi({ icon: Icon, label, value, sub, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; sub?: string;
  tone?: "default" | "warning" | "good" | "danger";
}) {
  const ring = tone === "warning" ? "ring-rag-amber/30"
    : tone === "good" ? "ring-rag-green/30"
    : tone === "danger" ? "ring-rag-red/30" : "ring-border";
  const accent = tone === "warning" ? "text-rag-amber bg-rag-amber/10"
    : tone === "good" ? "text-rag-green bg-rag-green/10"
    : tone === "danger" ? "text-rag-red bg-rag-red/10" : "text-accent bg-accent/10";
  return (
    <Card className={`shadow-sm ring-1 ${ring} border-0`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
            <div className="mt-1.5 font-display text-2xl text-foreground">{value}</div>
            {sub && <div className="mt-0.5 text-[11px] text-muted-foreground truncate">{sub}</div>}
          </div>
          <div className={`size-8 rounded-md grid place-items-center flex-shrink-0 ${accent}`}>
            <Icon className="size-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmployeeDetail({
  employee, onClose, onRegenerated,
}: { employee: Employee | null; onClose: () => void; onRegenerated: () => void }) {
  const generate = useServerFn(generateEmployeeInsight);
  const [busy, setBusy] = useState(false);

  const handleRegen = async () => {
    if (!employee) return;
    setBusy(true);
    try {
      await generate({ data: { emp_id: employee.emp_id } });
      toast.success("AI insight refreshed");
      onRegenerated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate insight");
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={!!employee} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6">
        {employee && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="font-display flex items-center gap-2 flex-wrap">
                {employee.name}
                <RagBadge score={employee.attrition_risk} />
              </SheetTitle>
              <SheetDescription>{employee.job_title} · {employee.sub_vertical}</SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-4 gap-2 text-xs mb-4">
              <Stat label="Perf" value={employee.h2_rating} />
              <Stat label="Potential" value={employee.potential_rating} />
              <Stat label="Risk" value={employee.attrition_risk} />
              <Stat label="AI Idx" value={employee.ai_readiness_score ?? "—"} />
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {employee.talent_segment && <Chip>{employee.talent_segment}</Chip>}
              {employee.leadership_readiness && <Chip>{LEADERSHIP_LABEL[employee.leadership_readiness]}</Chip>}
              {employee.ai_readiness_band && <Chip>{employee.ai_readiness_band}</Chip>}
            </div>

            <div className="rounded-lg border bg-card p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Brain className="size-3.5" /> AI HRBP Insight
                </div>
                <Button size="sm" variant="ghost" disabled={busy} onClick={handleRegen} className="h-7 gap-1.5 text-xs">
                  <RefreshCw className={`size-3 ${busy ? "animate-spin" : ""}`} /> Regenerate
                </Button>
              </div>
              <p className="text-sm whitespace-pre-wrap">{employee.hrbp_insights ?? "No insight yet. Click Regenerate."}</p>
            </div>

            {employee.flight_risk_drivers && employee.flight_risk_drivers.length > 0 && (
              <div className="mb-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Top Flight-Risk Drivers</div>
                <div className="flex flex-wrap gap-1.5">
                  {employee.flight_risk_drivers.map((d) => (
                    <span key={d} className="text-xs px-2.5 py-1 rounded-full bg-rag-red/10 text-rag-red border border-rag-red/20">{d}</span>
                  ))}
                </div>
              </div>
            )}

            {employee.ai_recommended_actions && employee.ai_recommended_actions.length > 0 && (
              <div className="mb-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Recommended Actions · 30-60 days</div>
                <ul className="space-y-1.5">
                  {employee.ai_recommended_actions.map((a, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="size-5 rounded-full bg-accent/10 text-accent grid place-items-center text-[10px] font-medium flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-3 text-sm pt-3 border-t">
              <Block label="Manager" value={employee.manager_email} />
              <Block label="Roll-up Manager" value={employee.rollup_manager_email ?? "—"} />
              <Block label="Function Head" value={employee.function_head_email ?? "—"} />
              <Block label="Succession · Next Steps" value={employee.succession_notes ?? "Not set."} />
              <Block label="Future Career Path" value={employee.future_career_path ?? "Not set."} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-secondary/60 p-2 text-center">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</div>
      <div className="font-display text-base">{value}</div>
    </div>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">{children}</span>;
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
  const qc = useQueryClient();
  const [picked, setPicked] = useState<Employee | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState<string>("all");
  const [riskBand, setRiskBand] = useState<string>("all");

  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department))).sort(), [employees]);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (dept !== "all" && e.department !== dept) return false;
      if (riskBand !== "all" && (e.retention_risk_band ?? "low") !== riskBand) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!`${e.name} ${e.job_title} ${e.sub_vertical} ${e.email}`.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [employees, dept, riskBand, search]);

  // Executive summary metrics (over filtered)
  const total = filtered.length;
  const avgRisk = total ? Math.round(filtered.reduce((s, e) => s + e.attrition_risk, 0) / total) : 0;
  const avgPerf = total ? (filtered.reduce((s, e) => s + e.h2_rating, 0) / total).toFixed(1) : "0.0";
  const highRisk = filtered.filter((e) => e.attrition_risk >= 65).length;
  const critical = filtered.filter((e) => (e.retention_risk_band === "critical") || e.talent_segment === "Critical Intervention" || e.talent_segment === "Flight Risk Stars").length;
  const successionReady = filtered.filter((e) => e.leadership_readiness === "ready_now" || e.leadership_readiness === "ready_1y").length;
  const aiReadyPct = total ? Math.round((filtered.filter((e) => e.ai_readiness_band === "AI Champion" || e.ai_readiness_band === "AI Ready").length / total) * 100) : 0;
  const stars = filtered.filter((e) => e.nine_box_quadrant === "Star").length;
  const newJoiners = filtered.filter((e) => tenureDays(e.joining_date) < 365).length;

  // Top retention concern driver
  const driverCount: Record<string, number> = {};
  for (const e of filtered) {
    if ((e.attrition_risk ?? 0) >= 50) for (const d of e.flight_risk_drivers ?? []) driverCount[d] = (driverCount[d] || 0) + 1;
  }
  const topDriver = Object.entries(driverCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const atRisk = useMemo(
    () => filtered.filter((e) => e.attrition_risk >= 60).sort((a, b) => b.attrition_risk - a.attrition_risk),
    [filtered],
  );

  const tier = isAdmin ? "HRBP Command Center"
    : role === "function_head" ? "Function Head Command Center"
    : role === "rollup_manager" ? "Roll-up Manager Command Center"
    : "Manager Command Center";

  const onRegenerated = () => {
    qc.invalidateQueries({ queryKey: ["employees"] });
    // refresh picked card from latest data after invalidation
    if (picked) {
      setTimeout(() => {
        const fresh = employees.find((e) => e.emp_id === picked.emp_id);
        if (fresh) setPicked(fresh);
      }, 500);
    }
  };

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-widest text-accent font-medium">{tier}</div>
          <h1 className="font-display text-3xl md:text-4xl">Good to see you{email ? `, ${email.split("@")[0]}` : ""}.</h1>
          <p className="text-muted-foreground text-sm">An AI-augmented snapshot of your team's health, risk, and momentum.</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportEmployeesXlsx(filtered, `talent-iq-${role ?? "team"}`)}>
          <Download className="size-4" /> Export Team Data
        </Button>
      </header>

      {/* Executive Summary */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
          <ExecKpi icon={Users} label="Visible" value={total} sub={isAdmin ? "org-wide" : "in span"} />
          <ExecKpi icon={AlertTriangle} label="High Risk" value={highRisk} sub="score ≥ 65" tone={highRisk > 0 ? "warning" : "default"} />
          <ExecKpi icon={Activity} label="Critical Talent" value={critical} sub="urgent action" tone={critical > 0 ? "danger" : "default"} />
          <ExecKpi icon={Crown} label="Succession Ready" value={successionReady} sub="now + 1yr" tone="good" />
          <ExecKpi icon={Brain} label="AI Readiness" value={`${aiReadyPct}%`} sub="Champion + Ready" />
          <ExecKpi icon={TrendingUp} label="Avg Perf" value={avgPerf} sub="/ 5" tone={Number(avgPerf) >= 3.5 ? "good" : "default"} />
          <ExecKpi icon={Target} label="Avg Risk" value={avgRisk} sub="/ 100" tone={avgRisk >= 60 ? "warning" : "default"} />
          <ExecKpi icon={Sparkles} label="Stars · New" value={`${stars} · ${newJoiners}`} sub="9-box · <12mo" />
        </div>
        <div className="mt-2 text-xs text-muted-foreground px-1">
          Top retention concern across visible team: <span className="font-medium text-foreground">{topDriver}</span>
        </div>
      </section>

      {/* Filters */}
      <section className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, role, sub-vertical…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)}
          className="px-3 py-2 text-sm rounded-md border border-input bg-background">
          <option value="all">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={riskBand} onChange={(e) => setRiskBand(e.target.value)}
          className="px-3 py-2 text-sm rounded-md border border-input bg-background">
          <option value="all">All risk bands</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        {(search || dept !== "all" || riskBand !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setDept("all"); setRiskBand("all"); }}>Clear</Button>
        )}
      </section>

      {/* Attention Required */}
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
                  <div className="font-medium truncate flex items-center gap-2">{e.name}
                    {e.talent_segment && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-normal">{e.talent_segment}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{e.job_title} · {e.sub_vertical}</div>
                </div>
                <RagBadge score={e.attrition_risk} />
              </button>
            ))}
          </CardContent></Card>
        )}
      </section>

      {/* All visible team table */}
      <section>
        <h2 className="font-display text-xl mb-3">Team Roster · {filtered.length}</h2>
        <Card><CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5 hidden md:table-cell">Department</th>
                <th className="text-left px-4 py-2.5 hidden lg:table-cell">Segment</th>
                <th className="text-center px-4 py-2.5">Perf</th>
                <th className="text-center px-4 py-2.5">Pot</th>
                <th className="text-center px-4 py-2.5">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((e) => (
                <tr key={e.emp_id} onClick={() => setPicked(e)} className="hover:bg-secondary/40 cursor-pointer">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{e.name}</div>
                    <div className="text-xs text-muted-foreground">{e.job_title}</div>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground">{e.department} · {e.sub_vertical}</td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-xs">{e.talent_segment ?? "—"}</td>
                  <td className="px-4 py-2.5 text-center">{e.h2_rating}</td>
                  <td className="px-4 py-2.5 text-center">{e.potential_rating}</td>
                  <td className="px-4 py-2.5 text-center"><RagBadge score={e.attrition_risk} /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No employees match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent></Card>
      </section>

      <EmployeeDetail employee={picked} onClose={() => setPicked(null)} onRegenerated={onRegenerated} />
    </div>
  );
}
