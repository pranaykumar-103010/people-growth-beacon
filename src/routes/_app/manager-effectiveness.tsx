import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { UserCog, Users, TrendingUp, AlertTriangle, ShieldCheck } from "lucide-react";
import { useScope, nameFromEmail } from "@/lib/scope";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/Kpi";
import { SoWhatFooter } from "@/components/SoWhatFooter";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { RagBadge } from "@/components/Rag";
import type { Employee } from "@/lib/types";

export const Route = createFileRoute("/_app/manager-effectiveness")({
  component: ManagerEffectiveness,
  head: () => ({
    meta: [{ title: "Manager Effectiveness · Talent IQ" }],
  }),
});

type Band = "green" | "amber" | "red";

const BAND_STYLE: Record<Band, string> = {
  green: "bg-rag-green/10 text-rag-green border-rag-green/30",
  amber: "bg-rag-amber/15 text-[oklch(0.45_0.15_60)] border-rag-amber/30",
  red: "bg-rag-red/10 text-rag-red border-rag-red/30",
};

function band(score: number): Band {
  if (score >= 75) return "green";
  if (score >= 55) return "amber";
  return "red";
}

type ManagerRow = {
  email: string;
  name: string;
  team: Employee[];
  avgRating: number;
  avgRisk: number;
  highRisk: number;
  cadencePct: number;
  avgGoalQuality: number | null;
  avgEnps: number | null;
  criticalRoles: number;
  benchStrength: number;
  score: number;
};

function buildManagerRows(employees: Employee[]): ManagerRow[] {
  const byMgr = new Map<string, Employee[]>();
  for (const e of employees) {
    const key = (e.manager_email ?? "").toLowerCase();
    if (!key) continue;
    byMgr.set(key, [...(byMgr.get(key) ?? []), e]);
  }

  return Array.from(byMgr.entries())
    .map(([email, team]) => {
      const n = team.length;
      const avgRating = team.reduce((s, e) => s + e.annual_rating, 0) / n;
      const avgRisk = team.reduce((s, e) => s + e.attrition_risk, 0) / n;
      const highRisk = team.filter((e) => e.attrition_risk >= 60).length;
      const cadenceGood = team.filter((e) => e.one_on_one_cadence === "Weekly" || e.one_on_one_cadence === "Fortnightly").length;
      const cadencePct = Math.round((cadenceGood / n) * 100);
      const goalVals = team.map((e) => e.goal_quality_index).filter((v): v is number => v !== null);
      const avgGoalQuality = goalVals.length ? goalVals.reduce((s, v) => s + v, 0) / goalVals.length : null;
      const enpsVals = team.map((e) => e.enps_score).filter((v): v is number => v !== null);
      const avgEnps = enpsVals.length ? enpsVals.reduce((s, v) => s + v, 0) / enpsVals.length : null;
      const criticalRoles = team.filter((e) => e.is_critical_role).length;
      const benchStrength = team.filter((e) => e.leadership_readiness === "ready_now" || e.leadership_readiness === "ready_1y").length;

      const retention = 100 - avgRisk;
      const performance = (avgRating / 5) * 100;
      const cadence = cadencePct;
      const goalQuality = avgGoalQuality !== null ? (avgGoalQuality / 5) * 100 : 60;
      const engagement = avgEnps !== null ? ((avgEnps + 100) / 200) * 100 : 60;
      const score = Math.round(retention * 0.3 + performance * 0.25 + cadence * 0.2 + goalQuality * 0.15 + engagement * 0.1);

      return {
        email, name: nameFromEmail(email), team, avgRating, avgRisk, highRisk, cadencePct,
        avgGoalQuality, avgEnps, criticalRoles, benchStrength, score,
      };
    })
    .sort((a, b) => a.score - b.score);
}

function ManagerEffectiveness() {
  const { employees } = useScope();
  const [picked, setPicked] = useState<ManagerRow | null>(null);

  const onRoll = useMemo(() => employees.filter((e) => e.active && !e.exit_date), [employees]);
  const rows = useMemo(() => buildManagerRows(onRoll), [onRoll]);

  const avgScore = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0;
  const needsSupport = rows.filter((r) => r.score < 55).length;
  const widestSpan = rows.reduce((max, r) => Math.max(max, r.team.length), 0);
  const staleCadence = rows.filter((r) => r.cadencePct < 50).length;

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-accent font-medium">People Leadership</div>
        <h1 className="font-display text-3xl md:text-4xl flex items-center gap-2">
          <UserCog className="size-7 text-accent" /> Manager Effectiveness
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          A composite 0–100 score per reporting manager — retention, performance, 1:1 cadence, goal quality and team engagement — so you know where to coach first.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="Managers in Scope" value={rows.length} sub={`Widest span: ${widestSpan} reports`} />
        <KpiCard icon={TrendingUp} label="Avg Effectiveness" value={avgScore} sub="Composite score / 100" tone={avgScore >= 70 ? "good" : avgScore >= 55 ? "warning" : "danger"} />
        <KpiCard icon={AlertTriangle} label="Need Support" value={needsSupport} sub="Score below 55" tone={needsSupport ? "danger" : "good"} />
        <KpiCard icon={ShieldCheck} label="Stale 1:1 Cadence" value={staleCadence} sub="< 50% of team on weekly/fortnightly" tone={staleCadence ? "warning" : "good"} />
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg">Managers · sorted by effectiveness (lowest first)</h2>
          <span className="text-xs text-muted-foreground">Click a manager for their team roster</span>
        </div>

        {rows.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No reporting managers found in this scope.</CardContent></Card>
        ) : (
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5">Manager</th>
                  <th className="text-center px-4 py-2.5">Team Size</th>
                  <th className="text-center px-4 py-2.5">Avg Rating</th>
                  <th className="text-center px-4 py-2.5">Attrition Risk</th>
                  <th className="text-center px-4 py-2.5 hidden md:table-cell">1:1 Cadence</th>
                  <th className="text-center px-4 py-2.5 hidden lg:table-cell">Bench Strength</th>
                  <th className="text-center px-4 py-2.5">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.email} className="hover:bg-secondary/40 cursor-pointer" onClick={() => setPicked(r)}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-[11px] text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-center">{r.team.length}</td>
                    <td className="px-4 py-2.5 text-center">{r.avgRating.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-center"><RagBadge score={Math.round(r.avgRisk)} /></td>
                    <td className="px-4 py-2.5 text-center hidden md:table-cell">{r.cadencePct}%</td>
                    <td className="px-4 py-2.5 text-center hidden lg:table-cell">{r.benchStrength} / {r.criticalRoles || "—"}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${BAND_STYLE[band(r.score)]}`}>{r.score}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        )}
      </section>

      <SoWhatFooter employees={onRoll} page="Manager Effectiveness" />

      <Sheet open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6">
          {picked && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="font-display flex items-center gap-2">
                  {picked.name}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${BAND_STYLE[band(picked.score)]}`}>{picked.score}/100</span>
                </SheetTitle>
                <SheetDescription>{picked.team.length} direct reports · {picked.email}</SheetDescription>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-3 text-xs mb-5">
                <div className="rounded-lg border p-3"><div className="text-muted-foreground">Avg Rating</div><div className="font-medium text-sm mt-0.5">{picked.avgRating.toFixed(2)} / 5</div></div>
                <div className="rounded-lg border p-3"><div className="text-muted-foreground">Avg Attrition Risk</div><div className="font-medium text-sm mt-0.5">{Math.round(picked.avgRisk)}</div></div>
                <div className="rounded-lg border p-3"><div className="text-muted-foreground">1:1 Cadence (weekly/fortnightly)</div><div className="font-medium text-sm mt-0.5">{picked.cadencePct}%</div></div>
                <div className="rounded-lg border p-3"><div className="text-muted-foreground">Goal Quality Index</div><div className="font-medium text-sm mt-0.5">{picked.avgGoalQuality !== null ? picked.avgGoalQuality.toFixed(2) : "—"}</div></div>
                <div className="rounded-lg border p-3"><div className="text-muted-foreground">Team eNPS</div><div className="font-medium text-sm mt-0.5">{picked.avgEnps !== null ? Math.round(picked.avgEnps) : "—"}</div></div>
                <div className="rounded-lg border p-3"><div className="text-muted-foreground">Succession Bench</div><div className="font-medium text-sm mt-0.5">{picked.benchStrength} ready of {picked.criticalRoles} critical roles</div></div>
              </div>

              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Direct Reports</div>
              <div className="space-y-2">
                {picked.team.map((e) => (
                  <div key={e.emp_id} className="flex items-center gap-3 p-2.5 rounded-md border">
                    <div className="size-8 rounded-full bg-accent/10 text-accent grid place-items-center text-xs font-medium flex-shrink-0">
                      {e.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{e.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{e.job_title} · {e.sub_vertical}</div>
                    </div>
                    <RagBadge score={e.attrition_risk} />
                  </div>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
