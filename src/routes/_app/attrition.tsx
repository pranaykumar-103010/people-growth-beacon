import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Download, Sparkles, Loader2, Filter } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { useEmployees } from "@/hooks/use-employees";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RagBadge } from "@/components/Rag";
import { exportEmployeesXlsx } from "@/lib/export";
import { generateScopedInsight } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/attrition")({
  component: AttritionRadar,
});

const ALL = "__all__";

function AttritionRadar() {
  const { role } = useAuth();
  const { data: employees = [] } = useEmployees();
  const genScoped = useServerFn(generateScopedInsight);

  const departments = useMemo(
    () => Array.from(new Set(employees.map((e) => e.department).filter(Boolean))).sort(),
    [employees]
  );

  const [department, setDepartment] = useState<string>("");
  const [subVertical, setSubVertical] = useState<string>(ALL);
  const [managerEmail, setManagerEmail] = useState<string>(ALL);

  // Default department once employees load
  useEffect(() => {
    if (!department && departments.length > 0) setDepartment(departments[0]);
  }, [departments, department]);

  const subVerticals = useMemo(() => {
    if (!department) return [];
    return Array.from(
      new Set(
        employees
          .filter((e) => e.department === department && e.sub_vertical)
          .map((e) => e.sub_vertical as string)
      )
    ).sort();
  }, [employees, department]);

  const managers = useMemo(() => {
    if (!department) return [];
    return Array.from(
      new Set(
        employees
          .filter(
            (e) =>
              e.department === department &&
              (subVertical === ALL || e.sub_vertical === subVertical) &&
              e.manager_email
          )
          .map((e) => e.manager_email)
      )
    ).sort();
  }, [employees, department, subVertical]);

  // Reset dependent selectors when parents change
  useEffect(() => { setSubVertical(ALL); setManagerEmail(ALL); }, [department]);
  useEffect(() => { setManagerEmail(ALL); }, [subVertical]);

  const scoped = useMemo(() => {
    return employees.filter(
      (e) =>
        (!department || e.department === department) &&
        (subVertical === ALL || e.sub_vertical === subVertical) &&
        (managerEmail === ALL || e.manager_email === managerEmail)
    );
  }, [employees, department, subVertical, managerEmail]);

  const { data: insight, isFetching: insightLoading, error: insightError, refetch } = useQuery({
    queryKey: ["scoped-insight", department, subVertical, managerEmail, scoped.length],
    enabled: !!department && scoped.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      genScoped({
        data: {
          department,
          sub_vertical: subVertical === ALL ? null : subVertical,
          manager_email: managerEmail === ALL ? null : managerEmail,
        },
      }),
  });

  // Risk distribution by sub-vertical (respects filter)
  const subVertData = useMemo(() => {
    const m: Record<string, { count: number; sumRisk: number }> = {};
    for (const e of scoped) {
      const k = e.sub_vertical || "Other";
      if (!m[k]) m[k] = { count: 0, sumRisk: 0 };
      m[k].count += 1; m[k].sumRisk += e.attrition_risk;
    }
    return Object.entries(m)
      .map(([sub_vertical, v]) => ({ sub_vertical, avgRisk: Math.round(v.sumRisk / v.count), count: v.count }))
      .sort((a, b) => b.avgRisk - a.avgRisk);
  }, [scoped]);

  const sorted = [...scoped].sort((a, b) => b.attrition_risk - a.attrition_risk);

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-accent font-medium">Attrition Radar</div>
          <h1 className="font-display text-3xl md:text-4xl">Risk trends across your teams</h1>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportEmployeesXlsx(scoped, `attrition-${role ?? "team"}`)}>
          <Download className="size-4" /> Export Team Data
        </Button>
      </header>

      {/* Cascading filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Filter className="size-3.5" /> Scope
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FilterField label="Department">
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Sub-department">
              <Select value={subVertical} onValueChange={setSubVertical} disabled={!department || subVerticals.length === 0}>
                <SelectTrigger><SelectValue placeholder="All sub-departments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All sub-departments</SelectItem>
                  {subVerticals.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Reporting manager">
              <Select value={managerEmail} onValueChange={setManagerEmail} disabled={!department || managers.length === 0}>
                <SelectTrigger><SelectValue placeholder="All managers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All managers</SelectItem>
                  {managers.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {scoped.length} employee{scoped.length === 1 ? "" : "s"} in scope
          </div>
        </CardContent>
      </Card>

      {/* Dynamic AI Insight */}
      <Card className="border-accent/30 bg-gradient-to-br from-accent/5 to-transparent">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent" />
              <div className="font-display text-base">
                AI Insight · {[department, subVertical !== ALL && subVertical, managerEmail !== ALL && managerEmail].filter(Boolean).join(" › ") || "Select a scope"}
              </div>
            </div>
            <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => refetch()} disabled={insightLoading || !department || scoped.length === 0}>
              {insightLoading ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
              Regenerate
            </Button>
          </div>

          {!department || scoped.length === 0 ? (
            <p className="text-sm text-muted-foreground">No employees visible in this scope.</p>
          ) : insightLoading && !insight ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="size-4 animate-spin" /> Generating scoped insight…
            </div>
          ) : insightError ? (
            <p className="text-sm text-red-600">{(insightError as Error).message}</p>
          ) : insight ? (
            <>
              <p className="text-sm">{insight.summary}</p>
              <div className="grid grid-cols-3 gap-2">
                <RiskChip label="High" pct={insight.risk_distribution.high_pct} tone="bad" />
                <RiskChip label="Medium" pct={insight.risk_distribution.medium_pct} tone="warn" />
                <RiskChip label="Low" pct={insight.risk_distribution.low_pct} tone="good" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <Bucket title="Key risk drivers" tone="warning" items={insight.key_risk_drivers} />
                <Bucket title="Recommended actions" tone="accent" items={insight.recommended_actions} />
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="text-sm font-medium mb-3">Average attrition risk by sub-vertical</div>
          {subVertData.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No employees in scope.</div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subVertData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" domain={[0, 100]} stroke="oklch(0.48 0.04 255)" fontSize={12} />
                  <YAxis dataKey="sub_vertical" type="category" stroke="oklch(0.48 0.04 255)" fontSize={12} width={150} />
                  <Tooltip cursor={{ fill: "oklch(0.95 0.015 250)" }}
                    contentStyle={{ background: "white", border: "1px solid oklch(0.91 0.013 250)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="avgRisk" radius={[0, 6, 6, 0]}>
                    {subVertData.map((d, i) => (
                      <Cell key={i} fill={d.avgRisk >= 65 ? "oklch(0.55 0.21 25)" : d.avgRisk >= 40 ? "oklch(0.72 0.17 70)" : "oklch(0.62 0.16 150)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Profiles · sorted by risk</h2>
        {sorted.map((e) => (
          <Card key={e.emp_id} id={e.emp_id}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-lg">{e.name}</div>
                  <div className="text-xs text-muted-foreground">{e.job_title} · {e.sub_vertical} · Manager: {e.manager_email}</div>
                </div>
                <RagBadge score={e.attrition_risk} />
              </div>
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div><div className="text-muted-foreground">Annual Rating</div><div className="font-medium text-sm">{e.annual_rating}/5</div></div>
                <div><div className="text-muted-foreground">Potential</div><div className="font-medium text-sm">{e.potential_rating}/5</div></div>
                <div><div className="text-muted-foreground">9-Box</div><div className="font-medium text-sm">{e.nine_box_quadrant}</div></div>
                <div><div className="text-muted-foreground">RAG</div><div className="font-medium text-sm capitalize">{e.rag_status}</div></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      {children}
    </div>
  );
}

function RiskChip({ label, pct, tone }: { label: string; pct: number; tone: "bad" | "warn" | "good" }) {
  const cls = tone === "bad" ? "border-rag-red/30 bg-rag-red/5 text-rag-red"
    : tone === "warn" ? "border-rag-amber/30 bg-rag-amber/5 text-rag-amber"
    : "border-rag-green/30 bg-rag-green/5 text-rag-green";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{label} risk</div>
      <div className="font-display text-2xl">{Math.round(pct)}%</div>
    </div>
  );
}

function Bucket({ title, tone, items }: { title: string; tone: "good" | "warning" | "accent"; items: string[] }) {
  const cls = tone === "good" ? "border-rag-green/30 bg-rag-green/5"
    : tone === "warning" ? "border-rag-amber/30 bg-rag-amber/5"
    : "border-accent/30 bg-accent/5";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">{title}</div>
      <ul className="space-y-1">
        {items.map((it, i) => <li key={i} className="text-xs leading-snug">• {it}</li>)}
      </ul>
    </div>
  );
}
