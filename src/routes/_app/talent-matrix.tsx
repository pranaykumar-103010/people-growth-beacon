import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useEmployees } from "@/hooks/use-employees";
import { useAuth } from "@/hooks/use-auth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Download, Sparkles, RefreshCw } from "lucide-react";
import { RagBadge } from "@/components/Rag";
import { exportEmployeesXlsx } from "@/lib/export";
import type { Employee, Quadrant } from "@/lib/types";
import { QUADRANT_DESC, tenureDays } from "@/lib/types";
import { moveEmployeeQuadrant } from "@/lib/employees.functions";
import { generateIdp } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/talent-matrix")({
  component: TalentMatrix,
});

// 3x3: rows top->bottom = potential (high→low); cols left->right = performance (low→high)
const LABELS: Quadrant[][] = [
  ["Question Mark", "Key Player", "Star"],          // high potential
  ["Inconsistent", "Core Player", "High Performer"],
  ["Iceberg", "Solid Performer", "Risk"],           // low potential
];

const COLOR: Record<Quadrant, string> = {
  Star: "bg-rag-green/30 text-rag-green border-2 border-rag-green/60",
  "High Performer": "bg-rag-green/25 text-rag-green border-2 border-rag-green/55",
  "Key Player": "bg-accent/25 text-accent border-2 border-accent/55",
  "Core Player": "bg-slate-blue/15 text-navy border-2 border-slate-blue/40",
  "Solid Performer": "bg-slate-blue/20 text-navy border-2 border-slate-blue/45",
  "Question Mark": "bg-rag-amber/30 text-[oklch(0.40_0.16_60)] border-2 border-rag-amber/65",
  Inconsistent: "bg-rag-amber/25 text-[oklch(0.40_0.16_60)] border-2 border-rag-amber/60",
  Iceberg: "bg-muted text-muted-foreground border-2 border-border",
  Risk: "bg-rag-red/25 text-rag-red border-2 border-rag-red/60",
};

const SUMMARY_TILES: Quadrant[] = ["Star", "Key Player", "High Performer", "Core Player", "Question Mark", "Risk"];

type Idp = {
  placement_reasoning: string[];
  development_priority: "Critical" | "High" | "Medium" | "Low";
  quick_wins_30d: string[];
  capability_60d: string[];
  outcomes_90d: string[];
  manager_actions: string[];
  hrbp_actions: string[];
  executive_summary: string;
  emp_id: string;
};

const PRIORITY_CLASS: Record<string, string> = {
  Critical: "bg-rag-red/15 text-rag-red border-rag-red/40",
  High: "bg-rag-amber/20 text-[oklch(0.42_0.16_60)] border-rag-amber/40",
  Medium: "bg-accent/15 text-accent border-accent/40",
  Low: "bg-rag-green/15 text-rag-green border-rag-green/40",
};

function TalentMatrix() {
  const { data: employees = [] } = useEmployees();
  const { role, isAdmin } = useAuth();
  const qc = useQueryClient();
  const move = useServerFn(moveEmployeeQuadrant);
  const runIdp = useServerFn(generateIdp);
  const [activeQuad, setActiveQuad] = useState<Quadrant | null>(null);
  const [picked, setPicked] = useState<Employee | null>(null);
  const [dragOver, setDragOver] = useState<Quadrant | null>(null);
  const [idp, setIdp] = useState<Idp | null>(null);
  const [idpBusy, setIdpBusy] = useState(false);

  const byQuadrant = useMemo(() => {
    const m = {} as Record<Quadrant, Employee[]>;
    for (const row of LABELS) for (const l of row) m[l] = [];
    for (const e of employees) {
      const q = (e.nine_box_quadrant as Quadrant) in m ? (e.nine_box_quadrant as Quadrant) : "Core Player";
      m[q].push(e);
    }
    return m;
  }, [employees]);

  const onDrop = async (target: Quadrant, empId: string) => {
    setDragOver(null);
    if (!isAdmin) return;
    const emp = employees.find((e) => e.emp_id === empId);
    if (!emp || emp.nine_box_quadrant === target) return;
    try {
      await move({ data: { emp_id: empId, quadrant: target } });
      toast.success(`${emp.name} moved to ${target}`);
      qc.invalidateQueries({ queryKey: ["employees"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Move failed");
    }
  };

  const openEmployee = (e: Employee) => { setPicked(e); setIdp(null); };

  const buildIdp = async (e: Employee) => {
    setIdpBusy(true);
    try {
      const out = (await runIdp({ data: { emp_id: e.emp_id } })) as Idp;
      setIdp(out);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate the development plan");
    } finally { setIdpBusy(false); }
  };

  return (
    <div className="px-5 md:px-8 pt-4 pb-4 max-w-[1600px] mx-auto h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
      <header className="mb-3 flex-shrink-0 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-accent font-medium">Performance × Potential</div>
          <h1 className="font-display text-2xl md:text-3xl leading-tight">Talent Segments</h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Click a tile or a person for their full profile and AI development plan{isAdmin ? " · drag anyone into another segment to override" : ""}.
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={employees.length === 0} onClick={() => exportEmployeesXlsx(employees, `talent-segments-${role ?? "team"}`)}>
          <Download className="size-3.5" /> Export Team
        </Button>
      </header>

      <div className="flex flex-wrap gap-2 mb-3 flex-shrink-0">
        {SUMMARY_TILES.map((q) => (
          <button key={q} onClick={() => setActiveQuad(q)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition hover:shadow-sm ${COLOR[q]}`}>
            {q}<span className="font-display text-sm">{byQuadrant[q]?.length ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        <div className="hidden md:flex flex-col items-center justify-between py-2">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
            Potential →
          </span>
        </div>
        <div className="flex-1 grid grid-cols-3 grid-rows-3 gap-2.5 min-h-0">
          {LABELS.flat().map((label) => {
            const list = byQuadrant[label] ?? [];
            return (
              <div
                key={label}
                onDragOver={(ev) => { if (isAdmin) { ev.preventDefault(); setDragOver(label); } }}
                onDragLeave={() => setDragOver((cur) => (cur === label ? null : cur))}
                onDrop={(ev) => { ev.preventDefault(); const id = ev.dataTransfer.getData("text/plain"); if (id) onDrop(label, id); }}
                className={`rounded-xl ${COLOR[label]} flex flex-col min-h-0 overflow-hidden transition shadow-sm ${dragOver === label ? "ring-4 ring-accent ring-offset-2" : ""}`}
              >
                <button
                  onClick={() => setActiveQuad(label)}
                  className="flex items-center justify-between px-3 py-2 border-b-2 border-current/25 hover:bg-black/5 transition flex-shrink-0"
                >
                  <div className="min-w-0 text-left">
                    <div className="text-[12px] uppercase tracking-wider font-bold leading-tight truncate">{label}</div>
                    <div className="text-[10px] opacity-75 leading-tight">{list.length} {list.length === 1 ? "person" : "people"}</div>
                  </div>
                  <span className="text-[10px] underline opacity-80 ml-2 flex-shrink-0 font-medium">View all →</span>
                </button>
                <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-1">
                  {list.map((e) => (
                    <button
                      key={e.emp_id}
                      onClick={() => openEmployee(e)}
                      draggable={isAdmin}
                      onDragStart={(ev) => { ev.dataTransfer.setData("text/plain", e.emp_id); ev.dataTransfer.effectAllowed = "move"; }}
                      title={`${e.name} · ${e.sub_vertical ?? "—"} · Mgr: ${e.manager_email}${e.nine_box_override ? " · manual override" : ""}`}
                      className="w-full text-left px-2 py-1 rounded-md bg-white/90 hover:bg-white border border-black/10 hover:border-black/20 transition"
                    >
                      <div className="text-[12.5px] font-semibold text-navy leading-tight truncate">{e.name}</div>
                      <div className="text-[10.5px] text-muted-foreground leading-tight truncate">{e.sub_vertical ?? e.job_title}</div>
                    </button>
                  ))}
                  {list.length === 0 && <div className="text-[11px] opacity-60 px-1 py-1">—</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold text-center pt-2 flex-shrink-0">Performance →</div>

      {/* Quadrant roster */}
      <Sheet open={!!activeQuad} onOpenChange={(o) => !o && setActiveQuad(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto p-6">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-display">{activeQuad}</SheetTitle>
            <SheetDescription>{activeQuad ? QUADRANT_DESC[activeQuad] : ""}</SheetDescription>
          </SheetHeader>
          <ul className="space-y-2">
            {activeQuad && byQuadrant[activeQuad]?.map((e) => (
              <li key={e.emp_id}>
                <button onClick={() => { setActiveQuad(null); openEmployee(e); }} className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-secondary/50 transition text-left">
                  <div className="size-9 rounded-full bg-accent/10 text-accent grid place-items-center text-sm font-medium">
                    {e.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-sm">{e.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{e.job_title} · {e.sub_vertical}</div>
                  </div>
                  <RagBadge score={e.attrition_risk} />
                </button>
              </li>
            ))}
            {activeQuad && (byQuadrant[activeQuad]?.length ?? 0) === 0 && (
              <li className="text-sm text-muted-foreground text-center py-8">No one in this segment.</li>
            )}
          </ul>
        </SheetContent>
      </Sheet>

      {/* Employee detail + AI IDP */}
      <Sheet open={!!picked} onOpenChange={(o) => { if (!o) { setPicked(null); setIdp(null); } }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-6">
          {picked && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="font-display flex items-center gap-2">{picked.name}<RagBadge score={picked.attrition_risk} /></SheetTitle>
                <SheetDescription>{picked.job_title} · {picked.sub_vertical} · {Math.round(tenureDays(picked.joining_date) / 30.44)} months tenure</SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-3 text-xs mb-4">
                <div><div className="text-muted-foreground">Annual Rating</div><div className="font-medium text-sm">{picked.annual_rating}</div></div>
                <div><div className="text-muted-foreground">Potential</div><div className="font-medium text-sm">{picked.potential_rating}</div></div>
                <div><div className="text-muted-foreground">Segment</div><div className="font-medium text-sm">{picked.nine_box_quadrant}</div></div>
              </div>

              <div className="rounded-lg border bg-card p-4 mb-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5" /> AI Individual Development Plan
                  </div>
                  <Button size="sm" variant={idp ? "ghost" : "default"} disabled={idpBusy} onClick={() => buildIdp(picked)} className="h-7 gap-1.5 text-xs">
                    <RefreshCw className={`size-3 ${idpBusy ? "animate-spin" : ""}`} /> {idp ? "Regenerate" : "Generate IDP"}
                  </Button>
                </div>

                {idpBusy && !idp && <p className="text-sm text-muted-foreground">Building a plan from ratings, risk, tenure and manager feedback…</p>}
                {!idpBusy && !idp && <p className="text-sm text-muted-foreground">Generate a personalised 30/60/90-day plan for {picked.name.split(" ")[0]}.</p>}

                {idp && (
                  <div className="space-y-4">
                    <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full border ${PRIORITY_CLASS[idp.development_priority]}`}>
                      {idp.development_priority} development priority
                    </span>
                    <IdpList title="Why they sit here" items={idp.placement_reasoning} />
                    <IdpList title="30-Day Quick Wins" items={idp.quick_wins_30d} numbered />
                    <IdpList title="60-Day Capability Building" items={idp.capability_60d} numbered />
                    <IdpList title="90-Day Measurable Outcomes" items={idp.outcomes_90d} numbered />
                    <IdpList title="Manager Action Plan" items={idp.manager_actions} />
                    <IdpList title="HRBP Lightweight Actions" items={idp.hrbp_actions} />
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Executive Summary</div>
                      <p className="text-sm">{idp.executive_summary}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 text-sm">
                <Block label="Manager" value={picked.manager_email} />
                <Block label="Roll-up Manager" value={picked.rollup_manager_email ?? "—"} />
                <Block label="Function Head" value={picked.function_head_email ?? "—"} />
                <Block label="Succession · Next Steps" value={picked.succession_notes ?? "Not set."} />
                <Block label="Future Career Path" value={picked.future_career_path ?? "Not set."} />
                <Block label="HRBP Insights" value={picked.hrbp_insights ?? "No qualitative notes yet."} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function IdpList({ title, items, numbered }: { title: string; items: string[]; numbered?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">{title}</div>
      <ul className="space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="text-sm flex items-start gap-2">
            <span className="size-5 rounded-full bg-accent/10 text-accent grid place-items-center text-[10px] font-medium flex-shrink-0 mt-0.5">
              {numbered ? i + 1 : "•"}
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
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
