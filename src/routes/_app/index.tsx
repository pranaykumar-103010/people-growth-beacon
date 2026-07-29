import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Users, UserPlus, TrendingUp, LogOut, CalendarRange, Activity, Download, RefreshCw, Brain, AlertTriangle, BarChart3 } from "lucide-react";
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

const BASELINE = new Date("2026-04-01T00:00:00Z");
const LEVELS = ["L0", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8"];

function KpiCard({ icon: Icon, label, value, tone, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number;
  tone?: "default" | "warning" | "good" | "danger";
  onClick?: () => void;
}) {
  const accent = tone === "warning" ? "text-rag-amber bg-rag-amber/10"
    : tone === "good" ? "text-rag-green bg-rag-green/10"
    : tone === "danger" ? "text-rag-red bg-rag-red/10" : "text-accent bg-accent/10";
  return (
    <Card
      onClick={onClick}
      className={`shadow-sm ring-1 ring-border border-0 ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition" : ""}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
            <div className="mt-1.5 font-display text-3xl text-foreground">{value}</div>
            {onClick && <div className="mt-0.5 text-[11px] text-accent">View details →</div>}
          </div>
          <div className={`size-9 rounded-md grid place-items-center flex-shrink-0 ${accent}`}>
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
              <Stat label="Annual" value={employee.annual_rating} />
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

function nameFromEmail(email: string | null | undefined) {
  if (!email) return "—";
  return email.split("@")[0].split(/[._-]/).filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
}

function tenureLabel(days: number) {
  const years = Math.floor(days / 365);
  const months = Math.round((days % 365) / 30.44);
  if (years <= 0) return `${months} mo`;
  return `${years}y ${months}m`;
}

function CommandCenter() {
  const { email, role, isAdmin } = useAuth();
  const { data: employees = [], isLoading } = useEmployees();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<Employee | null>(null);
  const [modal, setModal] = useState<"joiners" | "promotions" | null>(null);

  const onRoll = useMemo(() => employees.filter((e) => e.active && !e.exit_date), [employees]);

  const newJoiners = useMemo(
    () => onRoll.filter((e) => tenureDays(e.joining_date) <= 90).sort((a, b) => tenureDays(a.joining_date) - tenureDays(b.joining_date)),
    [onRoll],
  );
  const promotions = useMemo(
    () => employees.filter((e) => !!e.promotion_effective_date || !!e.promoted_level),
    [employees],
  );
  const exits = useMemo(
    () => employees.filter((e) => e.exit_date && new Date(e.exit_date) >= BASELINE),
    [employees],
  );
  const baseline = useMemo(
    () => employees.filter((e) => new Date(e.joining_date) < BASELINE && (!e.exit_date || new Date(e.exit_date) >= BASELINE)).length,
    [employees],
  );
  const activeHeadcount = baseline - exits.length;

  const byLevel = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of LEVELS) m[l] = 0;
    for (const e of onRoll) {
      const l = (e.level ?? "").toUpperCase().trim();
      if (l in m) m[l] += 1; else m[l || "Unmapped"] = (m[l || "Unmapped"] ?? 0) + 1;
    }
    return m;
  }, [onRoll]);
  const maxLevel = Math.max(1, ...Object.values(byLevel));

  const managerRows = useMemo(() => {
    const byMgr = new Map<string, Employee[]>();
    for (const e of onRoll) {
      const k = (e.manager_email ?? "").toLowerCase();
      if (!k) continue;
      byMgr.set(k, [...(byMgr.get(k) ?? []), e]);
    }
    const descendants = (mgr: string, seen = new Set<string>()): Employee[] => {
      if (seen.has(mgr)) return [];
      seen.add(mgr);
      const direct = byMgr.get(mgr) ?? [];
      return direct.flatMap((d) => [d, ...descendants((d.email ?? "").toLowerCase(), seen)]);
    };
    return Array.from(byMgr.keys()).map((mgr) => {
      const all = descendants(mgr);
      const avgDays = all.length ? all.reduce((s, e) => s + tenureDays(e.joining_date), 0) / all.length : 0;
      return { mgr, direct: (byMgr.get(mgr) ?? []).length, total: all.length, avg: tenureLabel(Math.round(avgDays)) };
    }).sort((a, b) => b.total - a.total);
  }, [onRoll]);

  const atRisk = useMemo(
    () => onRoll.filter((e) => e.attrition_risk >= 60).sort((a, b) => b.attrition_risk - a.attrition_risk),
    [onRoll],
  );

  const tier = isAdmin ? "HRBP Command Center"
    : role === "function_head" ? "Function Head Command Center"
    : role === "rollup_manager" ? "Roll-up Manager Command Center"
    : "Manager Command Center";

  const onRegenerated = () => {
    qc.invalidateQueries({ queryKey: ["employees"] });
    if (picked) {
      setTimeout(() => {
        const fresh = employees.find((e) => e.emp_id === picked.emp_id);
        if (fresh) setPicked(fresh);
      }, 500);
    }
  };

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-7">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-widest text-accent font-medium">{tier}</div>
          <h1 className="font-display text-3xl md:text-4xl">Good to see you{email ? `, ${email.split("@")[0]}` : ""}.</h1>
          <p className="text-muted-foreground text-sm">Executive overview of headcount, movement and risk across your scope.</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportEmployeesXlsx(onRoll, `talent-iq-${role ?? "team"}`)}>
          <Download className="size-4" /> Export Team Data
        </Button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={Users} label="Total On-Roll" value={onRoll.length} />
        <KpiCard icon={UserPlus} label="New Joiners" value={newJoiners.length} tone="good" onClick={() => setModal("joiners")} />
        <KpiCard icon={TrendingUp} label="Promotions" value={promotions.length} tone="good" onClick={() => setModal("promotions")} />
        <KpiCard icon={LogOut} label="Exits" value={exits.length} tone={exits.length > 0 ? "danger" : "default"} />
        <KpiCard icon={CalendarRange} label="Apr 2026 Baseline" value={baseline} />
        <KpiCard icon={Activity} label="Active Headcount" value={activeHeadcount} tone="good" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="size-4 text-accent" />
              <h2 className="font-display text-lg">Level-Wise Headcount</h2>
            </div>
            <div className="space-y-2">
              {Object.entries(byLevel).map(([lvl, count]) => (
                <div key={lvl} className="flex items-center gap-3">
                  <span className="w-16 text-xs font-medium text-muted-foreground">{lvl}</span>
                  <div className="flex-1 h-5 rounded bg-secondary/60 overflow-hidden">
                    <div className="h-full rounded bg-accent/70 transition-all" style={{ width: `${(count / maxLevel) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="size-4 text-accent" />
              <h2 className="font-display text-lg">Manager Distribution</h2>
            </div>
            <div className="max-h-[320px] overflow-y-auto -mx-1">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-1 pb-2">Manager</th>
                    <th className="text-center px-1 pb-2">Reportees</th>
                    <th className="text-right px-1 pb-2">Avg Tenure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {managerRows.map((r) => (
                    <tr key={r.mgr}>
                      <td className="px-1 py-2">
                        <div className="font-medium">{nameFromEmail(r.mgr)}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{r.mgr}</div>
                      </td>
                      <td className="px-1 py-2 text-center">
                        {r.total}<span className="text-[11px] text-muted-foreground"> ({r.direct} direct)</span>
                      </td>
                      <td className="px-1 py-2 text-right">{r.avg}</td>
                    </tr>
                  ))}
                  {managerRows.length === 0 && (
                    <tr><td colSpan={3} className="py-6 text-center text-sm text-muted-foreground">No managers in scope.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-xl flex items-center gap-2"><AlertTriangle className="size-5 text-rag-amber" /> Attention Required</h2>
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

      {/* New joiners / promotions detail */}
      <Sheet open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-6">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-display">{modal === "joiners" ? "New Joiners" : "Promotions"}</SheetTitle>
            <SheetDescription>
              {modal === "joiners" ? `${newJoiners.length} in scope` : `${promotions.length} promoted employees in scope`}
            </SheetDescription>
          </SheetHeader>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="text-left py-2">Code</th>
                <th className="text-left py-2">Name</th>
                {modal === "joiners" ? (
                  <>
                    <th className="text-left py-2">Level</th>
                    <th className="text-left py-2">Reporting Manager</th>
                    <th className="text-right py-2">Days</th>
                  </>
                ) : (
                  <>
                    <th className="text-left py-2">Previous</th>
                    <th className="text-left py-2">New Level</th>
                    <th className="text-right py-2">Effective</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(modal === "joiners" ? newJoiners : promotions).map((e) => (
                <tr key={e.emp_id}>
                  <td className="py-2 text-muted-foreground">{e.emp_id}</td>
                  <td className="py-2 font-medium">{e.name}</td>
                  {modal === "joiners" ? (
                    <>
                      <td className="py-2">{e.level ?? "—"}</td>
                      <td className="py-2 text-muted-foreground">{nameFromEmail(e.manager_email)}</td>
                      <td className="py-2 text-right">{tenureDays(e.joining_date)}</td>
                    </>
                  ) : (
                    <>
                      <td className="py-2">{e.previous_level ?? "—"}</td>
                      <td className="py-2">{e.promoted_level ?? e.level ?? "—"}</td>
                      <td className="py-2 text-right">{e.promotion_effective_date ?? "—"}</td>
                    </>
                  )}
                </tr>
              ))}
              {(modal === "joiners" ? newJoiners : promotions).length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Nothing recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </SheetContent>
      </Sheet>

      <EmployeeDetail employee={picked} onClose={() => setPicked(null)} onRegenerated={onRegenerated} />
    </div>
  );
}
