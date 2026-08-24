import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Users, UserPlus, TrendingUp, LogOut, BarChart3, Layers, Download, GitBranch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { KpiCard } from "@/components/Kpi";
import { SoWhatFooter } from "@/components/SoWhatFooter";
import { useScope, nameFromEmail } from "@/lib/scope";
import { tenureDays, tenureBand, TENURE_BANDS } from "@/lib/types";
import type { Employee } from "@/lib/types";
import { exportEmployeesXlsx } from "@/lib/export";

export const Route = createFileRoute("/_app/workforce")({
  component: Workforce,
  head: () => ({
    meta: [
      { title: "Workforce & Org Demographics · Talent IQ" },
      { name: "description", content: "Headcount pyramid, span-of-control analysis, level mix and manager distribution across the Tech organisation." },
      { property: "og:title", content: "Workforce & Org Demographics · Talent IQ" },
      { property: "og:description", content: "Headcount pyramid, span of control and manager distribution for HRBP and CXO reviews." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const LEVELS = ["L0", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8"];
const BASELINE = new Date("2026-04-01T00:00:00Z");

function tenureLabel(days: number) {
  const years = Math.floor(days / 365);
  const months = Math.round((days % 365) / 30.44);
  return years <= 0 ? `${months} mo` : `${years}y ${months}m`;
}

function Workforce() {
  const { employees } = useScope();
  const [modal, setModal] = useState<"joiners" | "promotions" | null>(null);

  const onRoll = useMemo(() => employees.filter((e) => e.active && !e.exit_date), [employees]);
  const newJoiners = useMemo(() => onRoll.filter((e) => tenureDays(e.joining_date) <= 90), [onRoll]);
  const promotions = useMemo(() => employees.filter((e) => !!e.promotion_effective_date || !!e.promoted_level), [employees]);
  const exits = useMemo(() => employees.filter((e) => e.exit_date && new Date(e.exit_date) >= BASELINE), [employees]);

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

  const pyramid = useMemo(() => {
    const entries = Object.entries(byLevel).filter(([, c]) => c > 0);
    return entries.sort((a, b) => b[0].localeCompare(a[0]));
  }, [byLevel]);

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
      return (byMgr.get(mgr) ?? []).flatMap((d) => [d, ...descendants((d.email ?? "").toLowerCase(), seen)]);
    };
    return Array.from(byMgr.keys()).map((mgr) => {
      const all = descendants(mgr);
      const direct = byMgr.get(mgr) ?? [];
      const avgDays = all.length ? all.reduce((s, e) => s + tenureDays(e.joining_date), 0) / all.length : 0;
      const risky = direct.filter((e) => e.attrition_risk >= 60).length;
      const health: "over" | "under" | "ok" = direct.length >= 9 ? "over" : direct.length <= 2 ? "under" : "ok";
      return { mgr, direct: direct.length, total: all.length, avg: tenureLabel(Math.round(avgDays)), risky, health };
    }).sort((a, b) => b.total - a.total);
  }, [onRoll]);

  const groupCount = (fn: (e: Employee) => string) => {
    const m = new Map<string, number>();
    for (const e of onRoll) {
      const k = fn(e) || "Unmapped";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  };
  const byLocation = useMemo(() => groupCount((e) => e.location ?? "Unmapped"), [onRoll]);
  const bySub = useMemo(() => groupCount((e) => e.sub_vertical ?? "Unmapped"), [onRoll]);
  const byTenure = useMemo(
    () => TENURE_BANDS.map((b) => [b, onRoll.filter((e) => tenureBand(e.joining_date) === b).length] as [string, number]),
    [onRoll],
  );

  const overloaded = managerRows.filter((m) => m.health === "over");
  const fragmented = managerRows.filter((m) => m.health === "under");

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-7">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-widest text-accent font-medium">Workforce & Org Demographics</div>
          <h1 className="font-display text-3xl md:text-4xl">How the organisation is shaped</h1>
          <p className="text-muted-foreground text-sm">Headcount pyramid, level mix, location spread and span-of-control health.</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportEmployeesXlsx(onRoll, "workforce-demographics")}>
          <Download className="size-4" /> Export
        </Button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="On-Roll" value={onRoll.length} />
        <KpiCard icon={UserPlus} label="New Joiners ≤ 90d" value={newJoiners.length} tone="good" onClick={() => setModal("joiners")} />
        <KpiCard icon={TrendingUp} label="Promotions" value={promotions.length} tone="good" onClick={() => setModal("promotions")} />
        <KpiCard icon={LogOut} label="Exits (FY26)" value={exits.length} tone={exits.length > 0 ? "danger" : "default"} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="size-4 text-accent" />
              <h2 className="font-display text-lg">Organisation Pyramid</h2>
            </div>
            <div className="space-y-1.5">
              {pyramid.map(([lvl, count]) => (
                <div key={lvl} className="flex items-center gap-3">
                  <span className="w-16 text-xs font-medium text-muted-foreground">{lvl}</span>
                  <div className="flex-1 flex justify-center">
                    <div className="h-6 rounded bg-accent/70 grid place-items-center text-[11px] font-semibold text-accent-foreground"
                      style={{ width: `${Math.max(8, (count / maxLevel) * 100)}%` }}>
                      {count}
                    </div>
                  </div>
                </div>
              ))}
              {pyramid.length === 0 && <p className="text-sm text-muted-foreground">No level data in scope.</p>}
            </div>
          </CardContent>
        </Card>

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
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {([["Location", byLocation], ["Sub-Department", bySub], ["Tenure Band", byTenure]] as [string, [string, number][]][]).map(([title, rows]) => (
          <Card key={title}>
            <CardContent className="p-5">
              <h3 className="font-display text-base mb-3">{title}</h3>
              <div className="space-y-2">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate text-muted-foreground">{k}</span>
                    <div className="w-20 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-accent/70" style={{ width: `${(v / Math.max(1, ...rows.map((r) => r[1]))) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right font-medium">{v}</span>
                  </div>
                ))}
                {rows.length === 0 && <p className="text-sm text-muted-foreground">No data.</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <GitBranch className="size-4 text-accent" />
              <h2 className="font-display text-lg">Span of Control Analyzer</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {overloaded.length} overloaded (9+ directs) · {fragmented.length} fragmented (≤ 2 directs) · healthy band is 3–8.
            </p>
            <div className="max-h-[380px] overflow-y-auto -mx-1">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-1 pb-2">Manager</th>
                    <th className="text-center px-1 pb-2">Direct</th>
                    <th className="text-center px-1 pb-2">Total</th>
                    <th className="text-center px-1 pb-2">At Risk</th>
                    <th className="text-center px-1 pb-2">Span Health</th>
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
                      <td className="px-1 py-2 text-center">{r.direct}</td>
                      <td className="px-1 py-2 text-center">{r.total}</td>
                      <td className="px-1 py-2 text-center">{r.risky}</td>
                      <td className="px-1 py-2 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          r.health === "over" ? "bg-rag-red/10 text-rag-red"
                            : r.health === "under" ? "bg-rag-amber/15 text-rag-amber"
                            : "bg-rag-green/10 text-rag-green"}`}>
                          {r.health === "over" ? "Overloaded" : r.health === "under" ? "Fragmented" : "Healthy"}
                        </span>
                      </td>
                      <td className="px-1 py-2 text-right">{r.avg}</td>
                    </tr>
                  ))}
                  {managerRows.length === 0 && (
                    <tr><td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No managers in scope.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <SoWhatFooter employees={employees} page="Workforce & Org Demographics" />

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
                    <th className="text-left py-2">Manager</th>
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
    </div>
  );
}
