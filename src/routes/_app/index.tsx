import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle, Download, HeartPulse, RefreshCw, Sparkles, TrendingUp, ShieldCheck, Users,
  UserPlus, LogOut, Briefcase, Star, Gauge, Percent,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useScope, SCOPE_LABEL } from "@/lib/scope";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RagBadge } from "@/components/Rag";
import { KpiCard } from "@/components/Kpi";
import { EmployeeDetail } from "@/components/EmployeeDetail";
import { SoWhatFooter } from "@/components/SoWhatFooter";
import { OrgHeatmapGrid } from "@/components/OrgHeatmapGrid";
import { exportEmployeesXlsx } from "@/lib/export";
import { tenureDays } from "@/lib/types";
import type { Employee } from "@/lib/types";
import { generateExecutiveInsights } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useOpenPositions } from "@/hooks/use-open-positions";

// Start of the current fiscal year — used for HC growth %, exits and new-joiner counters.
const FY_START = new Date("2026-04-01T00:00:00Z");

export const Route = createFileRoute("/_app/")({
  component: Overview,
  head: () => ({
    meta: [
      { title: "Executive Overview · Talent IQ" },
      { name: "description", content: "Organisation Health Index, enterprise risk heatmap and AI executive insights for the FieldAssist Tech organisation." },
      { property: "og:title", content: "Executive Overview · Talent IQ" },
      { property: "og:description", content: "Health index, risk heatmap and AI-generated talent takeaways for HRBP and CXO decision making." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Insight = { title: string; detail: string; tone: "good" | "watch" | "risk" };

const TONE_CLASS: Record<Insight["tone"], string> = {
  good: "border-rag-green/35 bg-rag-green/[0.06]",
  watch: "border-rag-amber/40 bg-rag-amber/[0.07]",
  risk: "border-rag-red/35 bg-rag-red/[0.06]",
};

function pct(n: number, d: number) {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

/** 0-100 composite: retention, performance, succession depth, engagement, manager cadence. */
function healthIndex(list: Employee[]) {
  if (list.length === 0) return { score: 0, parts: [] as { label: string; value: number }[] };
  const retention = 100 - list.reduce((s, e) => s + e.attrition_risk, 0) / list.length;
  const performance = (list.reduce((s, e) => s + e.annual_rating, 0) / list.length / 5) * 100;
  const critical = list.filter((e) => e.is_critical_role);
  const covered = critical.filter((e) => e.leadership_readiness === "ready_now" || e.leadership_readiness === "ready_1y");
  const succession = critical.length === 0 ? 70 : pct(covered.length, critical.length);
  const enpsVals = list.map((e) => e.enps_score).filter((v): v is number => v !== null);
  const engagement = enpsVals.length ? ((enpsVals.reduce((s, v) => s + v, 0) / enpsVals.length + 100) / 200) * 100 : 60;
  const cadence = pct(list.filter((e) => e.one_on_one_cadence === "Weekly" || e.one_on_one_cadence === "Fortnightly").length, list.length);
  const parts = [
    { label: "Retention", value: Math.round(retention) },
    { label: "Performance", value: Math.round(performance) },
    { label: "Succession Depth", value: Math.round(succession) },
    { label: "Engagement (eNPS)", value: Math.round(engagement) },
    { label: "Manager Cadence", value: Math.round(cadence) },
  ];
  const weights = [0.3, 0.25, 0.2, 0.15, 0.1];
  const score = Math.round(parts.reduce((s, p, i) => s + p.value * weights[i], 0));
  return { score, parts };
}

function Overview() {
  const { email, role, isAdmin } = useAuth();
  const { employees, scope, isLoading } = useScope();
  const { data: openPositions } = useOpenPositions();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const runInsights = useServerFn(generateExecutiveInsights);
  const [picked, setPicked] = useState<Employee | null>(null);
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [busy, setBusy] = useState(false);

  const onRoll = useMemo(() => employees.filter((e) => e.active && !e.exit_date), [employees]);
  const health = useMemo(() => healthIndex(onRoll), [onRoll]);
  const atRisk = useMemo(
    () => onRoll.filter((e) => e.attrition_risk >= 60).sort((a, b) => b.attrition_risk - a.attrition_risk),
    [onRoll],
  );
  const criticalUncovered = useMemo(
    () => onRoll.filter((e) => e.is_critical_role && e.leadership_readiness !== "ready_now" && e.leadership_readiness !== "ready_1y"),
    [onRoll],
  );
  const hipoAtRisk = useMemo(
    () => atRisk.filter((e) => e.potential_rating >= 3.5 && e.annual_rating >= 3.5),
    [atRisk],
  );

  // ---- Executive Scorecard ----
  const newJoiners = useMemo(() => onRoll.filter((e) => tenureDays(e.joining_date) <= 90), [onRoll]);
  const exitsFy = useMemo(() => employees.filter((e) => e.exit_date && new Date(e.exit_date) >= FY_START), [employees]);
  const hcAtFyStart = useMemo(
    () => employees.filter((e) => new Date(e.joining_date) <= FY_START && (!e.exit_date || new Date(e.exit_date) > FY_START)).length,
    [employees],
  );
  const hcGrowthPct = hcAtFyStart > 0 ? Math.round(((onRoll.length - hcAtFyStart) / hcAtFyStart) * 1000) / 10 : 0;
  const avgPerformance = onRoll.length ? onRoll.reduce((s, e) => s + e.annual_rating, 0) / onRoll.length : 0;
  const hipoOrCritical = useMemo(
    () => onRoll.filter((e) => e.is_critical_role || (e.potential_rating >= 3.5 && e.annual_rating >= 3.5)),
    [onRoll],
  );
  const avgHc = (hcAtFyStart + onRoll.length) / 2 || 1;
  const attritionPct = Math.round((exitsFy.length / avgHc) * 1000) / 10;
  const openPositionsCount = useMemo(() => openPositions.filter((p) => p.status === "open").length, [openPositions]);

  const heatmap = useMemo(() => {
    const m = new Map<string, Employee[]>();
    for (const e of onRoll) {
      const k = e.sub_vertical ?? "Unmapped";
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return Array.from(m.entries()).map(([sub, list]) => ({
      sub,
      size: list.length,
      risk: Math.round(list.reduce((s, e) => s + e.attrition_risk, 0) / list.length),
      rating: list.reduce((s, e) => s + e.annual_rating, 0) / list.length,
      critical: list.filter((e) => e.is_critical_role).length,
    })).sort((a, b) => b.risk - a.risk);
  }, [onRoll]);

  const summary = useMemo(() => {
    const lines = [
      `Population: ${onRoll.length} on-roll. Health Index ${health.score}/100 (${health.parts.map((p) => `${p.label} ${p.value}`).join(", ")}).`,
      `At flight risk (score >= 60): ${atRisk.length} (${pct(atRisk.length, onRoll.length)}%). High performers at risk: ${hipoAtRisk.length}.`,
      `Critical roles without ready-now/1-year successor: ${criticalUncovered.length}.`,
      `New joiners <= 90 days: ${onRoll.filter((e) => tenureDays(e.joining_date) <= 90).length}.`,
      "Sub-department telemetry (name | headcount | avg risk | avg rating | critical roles):",
      ...heatmap.map((h) => `${h.sub} | ${h.size} | ${h.risk} | ${h.rating.toFixed(2)} | ${h.critical}`),
    ];
    return lines.join("\n");
  }, [onRoll, health, atRisk, hipoAtRisk, criticalUncovered, heatmap]);

  const generate = async () => {
    setBusy(true);
    try {
      const out = (await runInsights({ data: { summary, scope: SCOPE_LABEL[scope] } })) as Insight[];
      setInsights(out);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate executive insights");
    } finally { setBusy(false); }
  };

  const tier = isAdmin ? "HRBP Command Center"
    : role === "function_head" ? "Function Head Command Center"
    : role === "rollup_manager" ? "Roll-up Command Center"
    : "Manager Command Center";

  const band = health.score >= 75 ? { label: "Healthy", cls: "text-rag-green bg-rag-green/10 ring-rag-green/30" }
    : health.score >= 60 ? { label: "Watch", cls: "text-rag-amber bg-rag-amber/10 ring-rag-amber/30" }
    : { label: "At Risk", cls: "text-rag-red bg-rag-red/10 ring-rag-red/30" };

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-7">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-widest text-accent font-medium">{tier} · {SCOPE_LABEL[scope]}</div>
          <h1 className="font-display text-3xl md:text-4xl">Good to see you{email ? `, ${email.split("@")[0]}` : ""}.</h1>
          <p className="text-muted-foreground text-sm">One screen for organisation health, concentrated risk and what to do next.</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportEmployeesXlsx(onRoll, `talent-iq-${role ?? "team"}`)}>
          <Download className="size-4" /> Export Team Data
        </Button>
      </header>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-lg">Executive Scorecard</h2>
          <span className="text-[11px] text-muted-foreground">FY26 · {SCOPE_LABEL[scope]}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={Users} label="Current HC" value={onRoll.length} sub={`${hcGrowthPct >= 0 ? "+" : ""}${hcGrowthPct}% vs FY start`} tone={hcGrowthPct < 0 ? "warning" : "good"} onClick={() => navigate({ to: "/workforce" })} />
          <KpiCard icon={UserPlus} label="New Joiners" value={newJoiners.length} sub="≤ 90 days tenure" tone="good" onClick={() => navigate({ to: "/new-joiners" })} />
          <KpiCard icon={LogOut} label="Exits" value={exitsFy.length} sub="FY26 to date" tone={exitsFy.length > 0 ? "warning" : "good"} onClick={() => navigate({ to: "/workforce" })} />
          <KpiCard icon={Briefcase} label="Open Positions" value={openPositionsCount} sub={`${openPositions.length} tracked total`} onClick={() => navigate({ to: "/workforce" })} />
          <KpiCard icon={TrendingUp} label="HC Growth" value={`${hcGrowthPct >= 0 ? "+" : ""}${hcGrowthPct}%`} sub="Since FY start" tone={hcGrowthPct < 0 ? "warning" : "good"} onClick={() => navigate({ to: "/workforce" })} />
          <KpiCard icon={Star} label="Avg Performance" value={avgPerformance.toFixed(2)} sub="Annual rating / 5" onClick={() => navigate({ to: "/high-performers" })} />
          <KpiCard icon={Gauge} label="HiPo + Critical" value={hipoOrCritical.length} sub="High potential or critical role" tone="good" onClick={() => navigate({ to: "/talent-matrix" })} />
          <KpiCard icon={Percent} label="Attrition %" value={`${attritionPct}%`} sub="FY26 exits / avg HC" tone={attritionPct >= 15 ? "danger" : attritionPct >= 8 ? "warning" : "good"} onClick={() => navigate({ to: "/attrition" })} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="ring-1 ring-border border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <HeartPulse className="size-4 text-accent" />
              <h2 className="font-display text-lg">Org Health Index</h2>
            </div>
            <div className="flex items-end gap-3">
              <div className="font-display text-6xl leading-none">{health.score}</div>
              <span className={`mb-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ${band.cls}`}>{band.label}</span>
            </div>
            <div className="mt-4 space-y-2">
              {health.parts.map((p) => (
                <div key={p.label} className="flex items-center gap-2 text-xs">
                  <span className="w-32 text-muted-foreground truncate">{p.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-accent/75" style={{ width: `${Math.min(100, Math.max(0, p.value))}%` }} />
                  </div>
                  <span className="w-7 text-right font-medium">{p.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 content-start">
          <KpiCard icon={Users} label="On-Roll" value={onRoll.length} sub={`${SCOPE_LABEL[scope]}`} />
          <KpiCard icon={AlertTriangle} label="At Flight Risk" value={atRisk.length} sub={`${pct(atRisk.length, onRoll.length)}% of scope`} tone={atRisk.length ? "danger" : "good"} />
          <KpiCard icon={TrendingUp} label="High Performers at Risk" value={hipoAtRisk.length} sub="Rating & potential ≥ 3.5" tone={hipoAtRisk.length ? "warning" : "good"} />
          <KpiCard icon={ShieldCheck} label="Uncovered Critical Roles" value={criticalUncovered.length} sub="No ready-now / 1-yr successor" tone={criticalUncovered.length ? "warning" : "good"} />
        </div>
      </section>

      <section>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-accent" />
                <h2 className="font-display text-lg">AI Executive Insights</h2>
              </div>
              <Button size="sm" variant={insights ? "ghost" : "default"} disabled={busy || onRoll.length === 0} onClick={generate} className="h-8 gap-1.5 text-xs">
                <RefreshCw className={`size-3 ${busy ? "animate-spin" : ""}`} /> {insights ? "Regenerate" : "Generate"}
              </Button>
            </div>
            {!insights && !busy && (
              <p className="text-sm text-muted-foreground">
                Generate board-ready takeaways from the current scope and filters — {onRoll.length} people, {heatmap.length} sub-departments.
              </p>
            )}
            {busy && !insights && <p className="text-sm text-muted-foreground">Reading risk, performance, succession and cadence signals…</p>}
            {insights && (
              <div className="grid gap-3 md:grid-cols-2">
                {insights.map((i, idx) => (
                  <div key={idx} className={`rounded-lg border p-3.5 ${TONE_CLASS[i.tone]}`}>
                    <div className="text-sm font-semibold mb-1">{i.title}</div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{i.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardContent className="p-5">
            <OrgHeatmapGrid employees={onRoll} />
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
            No one above the 60 risk threshold in this scope.
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
                    {e.is_critical_role && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rag-red/10 text-rag-red font-normal">Critical role</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{e.job_title} · {e.sub_vertical} · {e.location ?? "—"}</div>
                </div>
                <RagBadge score={e.attrition_risk} />
              </button>
            ))}
          </CardContent></Card>
        )}
      </section>

      <SoWhatFooter employees={employees} page="Executive Overview" />

      <EmployeeDetail
        employee={picked}
        onClose={() => setPicked(null)}
        onRegenerated={() => qc.invalidateQueries({ queryKey: ["employees"] })}
      />
    </div>
  );
}
