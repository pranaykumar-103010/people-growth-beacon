import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Sparkles, Loader2, Building2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { useEmployees } from "@/hooks/use-employees";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RagBadge } from "@/components/Rag";
import { exportEmployeesXlsx } from "@/lib/export";
import { generateDepartmentInsight, listDepartmentInsights } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/attrition")({
  component: AttritionRadar,
});


function AttritionRadar() {
  const { role, isAdmin } = useAuth();
  const { data: employees = [] } = useEmployees();
  const qc = useQueryClient();
  const genDept = useServerFn(generateDepartmentInsight);
  const listDept = useServerFn(listDepartmentInsights);
  const [busyDept, setBusyDept] = useState<string | null>(null);

  const { data: deptInsights = [] } = useQuery({
    queryKey: ["dept-insights"],
    queryFn: () => listDept(),
  });

  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department))).sort(), [employees]);

  const runDept = async (department: string) => {
    setBusyDept(department);
    try {
      await genDept({ data: { department } });
      toast.success(`Insight ready for ${department}`);
      qc.invalidateQueries({ queryKey: ["dept-insights"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusyDept(null); }
  };


  // Risk distribution by sub-vertical
  const subVertData = useMemo(() => {
    const m: Record<string, { count: number; sumRisk: number }> = {};
    for (const e of employees) {
      const k = e.sub_vertical || "Other";
      if (!m[k]) m[k] = { count: 0, sumRisk: 0 };
      m[k].count += 1; m[k].sumRisk += e.attrition_risk;
    }
    return Object.entries(m)
      .map(([sub_vertical, v]) => ({ sub_vertical, avgRisk: Math.round(v.sumRisk / v.count), count: v.count }))
      .sort((a, b) => b.avgRisk - a.avgRisk);
  }, [employees]);

  const sorted = [...employees].sort((a, b) => b.attrition_risk - a.attrition_risk);

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-accent font-medium">Attrition Radar</div>
          <h1 className="font-display text-3xl md:text-4xl">Risk trends across sub-verticals</h1>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportEmployeesXlsx(employees, `attrition-${role ?? "team"}`)}>
          <Download className="size-4" /> Export Team Data
        </Button>
      </header>

      <Card>
        <CardContent className="p-5">
          <div className="text-sm font-medium mb-3">Average attrition risk by sub-vertical</div>
          {subVertData.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No employees in view yet.</div>
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

      {/* Department-level insights */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-xl flex items-center gap-2"><Building2 className="size-5" /> Department Insights</h2>
          <span className="text-xs text-muted-foreground">{deptInsights.length} cached · {departments.length} visible</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {departments.map((d) => {
            const cached = (deptInsights as Array<{ department: string; summary?: string; strengths: string[]; risks: string[]; actions: string[] }>).find((x) => x.department === d);
            return (
              <Card key={d}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-display text-base">{d}</div>
                    {isAdmin && (
                      <Button size="sm" variant="outline" disabled={busyDept === d} onClick={() => runDept(d)} className="h-8 gap-1.5 text-xs">
                        {busyDept === d ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                        {cached ? "Regenerate" : "Generate"}
                      </Button>
                    )}
                  </div>
                  {cached ? (
                    <>
                      {cached.summary && <p className="text-sm">{cached.summary}</p>}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <Bucket title="Strengths" tone="good" items={cached.strengths} />
                        <Bucket title="Risks" tone="warning" items={cached.risks} />
                        <Bucket title="Actions" tone="accent" items={cached.actions} />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">{isAdmin ? "Click Generate to produce an AI HRBP summary." : "No insight cached yet — ask your HRBP to generate one."}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

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
                <div><div className="text-muted-foreground">H2 Rating</div><div className="font-medium text-sm">{e.h2_rating}/5</div></div>
                <div><div className="text-muted-foreground">Potential</div><div className="font-medium text-sm">{e.potential_rating}/5</div></div>
                <div><div className="text-muted-foreground">9-Box</div><div className="font-medium text-sm">{e.nine_box_quadrant}</div></div>
                <div><div className="text-muted-foreground">RAG</div><div className="font-medium text-sm capitalize">{e.rag_status}</div></div>
              </div>
              {e.hrbp_insights && (
                <div className="text-sm border-t pt-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">HRBP Insights</div>
                  <p className="whitespace-pre-wrap">{e.hrbp_insights}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
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

