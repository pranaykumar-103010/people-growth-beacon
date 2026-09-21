import { useMemo } from "react";
import { Grid3x3 } from "lucide-react";
import type { Employee } from "@/lib/types";

type Rag = "green" | "amber" | "red" | "—";

const RAG_STYLE: Record<Rag, string> = {
  green: "bg-rag-green/15 text-rag-green border-rag-green/40",
  amber: "bg-rag-amber/15 text-[oklch(0.42_0.16_60)] border-rag-amber/40",
  red: "bg-rag-red/15 text-rag-red border-rag-red/40",
  "—": "bg-secondary text-muted-foreground border-border",
};

const RAG_LABEL: Record<Rag, string> = { green: "Green", amber: "Amber", red: "Red", "—": "No data" };

function Cell({ value }: { value: Rag }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${RAG_STYLE[value]}`}>
      <span className={`size-1.5 rounded-full ${value === "—" ? "bg-muted-foreground/40" : `bg-current`}`} />
      {RAG_LABEL[value]}
    </span>
  );
}

/** Talent Performance Health = composite of avg rating, avg potential, and critical-role coverage. */
function talentHealthRag(list: Employee[]): Rag {
  if (list.length === 0) return "—";
  const avgPerf = list.reduce((s, e) => s + e.annual_rating, 0) / list.length;
  const avgPot = list.reduce((s, e) => s + e.potential_rating, 0) / list.length;
  const critical = list.filter((e) => e.is_critical_role);
  const coverage = critical.length === 0 ? 1 : critical.filter((e) => e.leadership_readiness === "ready_now" || e.leadership_readiness === "ready_1y").length / critical.length;
  const score = avgPerf * 0.4 + avgPot * 0.35 + coverage * 5 * 0.25; // scaled to ~1-5
  if (score >= 3.6) return "green";
  if (score >= 2.8) return "amber";
  return "red";
}

function attritionRag(list: Employee[]): Rag {
  if (list.length === 0) return "—";
  const avg = list.reduce((s, e) => s + e.attrition_risk, 0) / list.length;
  if (avg < 40) return "green";
  if (avg < 65) return "amber";
  return "red";
}

function engagementRag(list: Employee[]): Rag {
  const vals = list.map((e) => e.enps_score).filter((v): v is number => v !== null);
  if (vals.length === 0) return "—";
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  if (avg >= 20) return "green";
  if (avg >= 0) return "amber";
  return "red";
}

function performanceRag(list: Employee[]): Rag {
  if (list.length === 0) return "—";
  const avg = list.reduce((s, e) => s + e.annual_rating, 0) / list.length;
  if (avg >= 3.5) return "green";
  if (avg >= 2.5) return "amber";
  return "red";
}

export function OrgHeatmapGrid({ employees }: { employees: Employee[] }) {
  const rows = useMemo(() => {
    // Group by department when the org spans more than one; otherwise fall back to
    // sub-department so a single-department org (e.g. all-Technology today) still segments.
    const byDept = new Map<string, Employee[]>();
    for (const e of employees) byDept.set(e.department, [...(byDept.get(e.department) ?? []), e]);
    const groupKey: (e: Employee) => string = byDept.size > 1 ? (e) => e.department : (e) => e.sub_vertical ?? "Unmapped";

    const m = new Map<string, Employee[]>();
    for (const e of employees) {
      const k = groupKey(e);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return Array.from(m.entries())
      .map(([label, list]) => ({
        label,
        count: list.length,
        talent: talentHealthRag(list),
        attrition: attritionRag(list),
        engagement: engagementRag(list),
        performance: performanceRag(list),
      }))
      .sort((a, b) => b.count - a.count);
  }, [employees]);

  const groupLabel = useMemo(() => {
    const depts = new Set(employees.map((e) => e.department));
    return depts.size > 1 ? "Function" : "Sub-Department";
  }, [employees]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Grid3x3 className="size-4 text-accent" />
        <h2 className="font-display text-lg">Organization Heatmap</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Instant leadership view — {groupLabel.toLowerCase()} health across the four signals that matter most.
      </p>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b">
              <th className="text-left px-2 pb-2">{groupLabel}</th>
              <th className="text-center px-2 pb-2">Talent Performance Health</th>
              <th className="text-center px-2 pb-2">Attrition Risk</th>
              <th className="text-center px-2 pb-2">Engagement</th>
              <th className="text-center px-2 pb-2">Performance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="px-2 py-2.5">
                  <div className="font-medium">{r.label}</div>
                  <div className="text-[11px] text-muted-foreground">{r.count} people</div>
                </td>
                <td className="px-2 py-2.5 text-center"><Cell value={r.talent} /></td>
                <td className="px-2 py-2.5 text-center"><Cell value={r.attrition} /></td>
                <td className="px-2 py-2.5 text-center"><Cell value={r.engagement} /></td>
                <td className="px-2 py-2.5 text-center"><Cell value={r.performance} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No population in scope.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
