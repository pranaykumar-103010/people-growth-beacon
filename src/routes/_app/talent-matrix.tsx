import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useEmployees } from "@/hooks/use-employees";
import { useAuth } from "@/hooks/use-auth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { RagBadge } from "@/components/Rag";
import { exportEmployeesXlsx } from "@/lib/export";
import type { Employee, Quadrant } from "@/lib/types";
import { QUADRANT_DESC } from "@/lib/types";
import { moveEmployeeQuadrant } from "@/lib/employees.functions";
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

function TalentMatrix() {
  const { data: employees = [] } = useEmployees();
  const { role, isAdmin } = useAuth();
  const qc = useQueryClient();
  const move = useServerFn(moveEmployeeQuadrant);
  const [activeQuad, setActiveQuad] = useState<Quadrant | null>(null);
  const [picked, setPicked] = useState<Employee | null>(null);
  const [dragOver, setDragOver] = useState<Quadrant | null>(null);

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

  return (
    <div className="px-5 md:px-8 pt-5 md:pt-6 pb-2 max-w-7xl mx-auto h-[calc(100vh-3.5rem)] md:h-screen flex flex-col overflow-hidden">
      <header className="mb-4 flex-shrink-0 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-accent font-medium">Talent Matrix</div>
          <h1 className="font-display text-2xl md:text-3xl">9-Box · Performance × Potential</h1>
          <p className="text-muted-foreground text-xs mt-1">Click a tile to see everyone · click a person for their full profile{isAdmin ? " · drag anyone into another quadrant to override" : ""}.</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={employees.length === 0} onClick={() => exportEmployeesXlsx(employees, `talent-matrix-${role ?? "team"}`)}>
          <Download className="size-3.5" /> Export Team
        </Button>
      </header>

      <div className="flex gap-2 flex-1 min-h-0">
        <div className="hidden md:flex flex-col items-center justify-between py-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
            Potential →
          </span>
        </div>
        <div className="flex-1 grid grid-cols-3 grid-rows-3 gap-2 min-h-0">
          {LABELS.flat().map((label) => {
            const list = byQuadrant[label] ?? [];
            const color = COLOR[label];
            return (
              <div
                key={label}
                onDragOver={(ev) => { if (isAdmin) { ev.preventDefault(); setDragOver(label); } }}
                onDragLeave={() => setDragOver((cur) => (cur === label ? null : cur))}
                onDrop={(ev) => { ev.preventDefault(); const id = ev.dataTransfer.getData("text/plain"); if (id) onDrop(label, id); }}
                className={`rounded-xl border ${color} flex flex-col min-h-0 overflow-hidden transition ${dragOver === label ? "ring-2 ring-accent" : ""}`}
              >
                <button
                  onClick={() => setActiveQuad(label)}
                  className="flex items-center justify-between px-2.5 py-1.5 border-b border-current/20 hover:bg-black/5 transition flex-shrink-0"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider opacity-80 leading-tight truncate">{label}</div>
                    <div className="text-[10px] opacity-60 leading-tight">{list.length} {list.length === 1 ? "person" : "people"}</div>
                  </div>
                  <span className="text-[10px] underline opacity-70 ml-2 flex-shrink-0">View all →</span>
                </button>
                <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-1">
                  {list.map((e) => (
                    <button
                      key={e.emp_id}
                      onClick={() => setPicked(e)}
                      draggable={isAdmin}
                      onDragStart={(ev) => { ev.dataTransfer.setData("text/plain", e.emp_id); ev.dataTransfer.effectAllowed = "move"; }}
                      title={`${e.name} · ${e.sub_vertical ?? "—"} · Mgr: ${e.manager_email}${e.nine_box_override ? " · manual override" : ""}`}
                      className={`w-full text-left px-2 py-1 rounded bg-white/70 hover:bg-white border border-black/5 transition text-[11px] leading-tight ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""}`}
                    >
                      <div className="font-medium text-foreground truncate flex items-center gap-1">
                        {e.name}
                        {e.nine_box_override && <span className="text-[9px] opacity-60">•</span>}
                      </div>
                      <div className="text-muted-foreground truncate">
                        {(e.sub_vertical ?? "—")} · {e.manager_email.split("@")[0]}
                      </div>
                    </button>
                  ))}
                  {list.length === 0 && (
                    <div className="text-[10px] opacity-50 px-2 py-1">empty</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 flex-shrink-0 md:pl-6">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Low</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Performance →</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">High</span>
      </div>

      {/* Quadrant list */}
      <Sheet open={!!activeQuad} onOpenChange={(o) => !o && setActiveQuad(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto p-6">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-display">{activeQuad}</SheetTitle>
            <SheetDescription>{activeQuad ? QUADRANT_DESC[activeQuad] : ""}</SheetDescription>
          </SheetHeader>
          <ul className="space-y-2">
            {activeQuad && byQuadrant[activeQuad]?.map((e) => (
              <li key={e.emp_id}>
                <button onClick={() => { setActiveQuad(null); setPicked(e); }} className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-secondary/50 transition text-left">
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
              <li className="text-sm text-muted-foreground text-center py-8">No one in this quadrant.</li>
            )}
          </ul>
        </SheetContent>
      </Sheet>

      {/* Employee detail */}
      <Sheet open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6">
          {picked && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="font-display flex items-center gap-2">{picked.name}<RagBadge score={picked.attrition_risk} /></SheetTitle>
                <SheetDescription>{picked.job_title} · {picked.sub_vertical}</SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-3 text-xs mb-4">
                <div><div className="text-muted-foreground">H2 Rating</div><div className="font-medium text-sm">{picked.h2_rating}</div></div>
                <div><div className="text-muted-foreground">Potential</div><div className="font-medium text-sm">{picked.potential_rating}</div></div>
                <div><div className="text-muted-foreground">9-Box</div><div className="font-medium text-sm">{picked.nine_box_quadrant}</div></div>
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

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="whitespace-pre-wrap text-sm">{value}</div>
    </div>
  );
}
