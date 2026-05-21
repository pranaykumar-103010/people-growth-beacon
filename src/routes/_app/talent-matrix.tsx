import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useEmployees } from "@/hooks/use-employees";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { RagBadge } from "@/components/Rag";
import type { Employee } from "@/lib/types";

export const Route = createFileRoute("/_app/talent-matrix")({
  component: TalentMatrix,
});

// 3x3: rows = potential (high top), cols = performance (high right)
const LABELS = [
  ["Question Mark", "Key Player", "Star"],          // high potential
  ["Inconsistent", "Core Player", "High Performer"],
  ["Iceberg", "Solid Performer", "Risk"],           // low potential
];

const COLOR: Record<string, string> = {
  Star: "bg-rag-green/15 text-rag-green border-rag-green/30",
  "High Performer": "bg-rag-green/10 text-rag-green border-rag-green/30",
  "Key Player": "bg-accent/15 text-accent border-accent/30",
  "Core Player": "bg-secondary text-foreground border-border",
  "Solid Performer": "bg-secondary text-foreground border-border",
  "Question Mark": "bg-rag-amber/15 text-[oklch(0.45_0.15_60)] border-rag-amber/30",
  Inconsistent: "bg-rag-amber/10 text-[oklch(0.45_0.15_60)] border-rag-amber/30",
  Iceberg: "bg-muted text-muted-foreground border-border",
  Risk: "bg-rag-red/10 text-rag-red border-rag-red/30",
};

function bucket(e: Employee, label: string): boolean {
  return (e.nine_box_quadrant || "Core Player").toLowerCase() === label.toLowerCase();
}

function TalentMatrix() {
  const { data: employees = [] } = useEmployees();
  const [active, setActive] = useState<string | null>(null);

  const byQuadrant = useMemo(() => {
    const m: Record<string, Employee[]> = {};
    for (const row of LABELS) for (const l of row) m[l] = employees.filter((e) => bucket(e, l));
    return m;
  }, [employees]);

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-accent font-medium">Talent Matrix</div>
        <h1 className="font-display text-3xl md:text-4xl">9-Box · Performance × Potential</h1>
        <p className="text-muted-foreground text-sm mt-1">Click any quadrant to see who sits inside.</p>
      </header>

      <div className="flex gap-3">
        <div className="hidden md:flex flex-col justify-between py-6 -ml-1">
          <div className="text-xs uppercase tracking-widest text-muted-foreground rotate-180" style={{ writingMode: "vertical-rl" }}>← Higher Potential</div>
        </div>
        <div className="flex-1 grid grid-cols-3 gap-2 md:gap-3 aspect-[5/4]">
          {LABELS.flat().map((label) => {
            const list = byQuadrant[label] ?? [];
            const color = COLOR[label];
            return (
              <button
                key={label}
                onClick={() => setActive(label)}
                className={`text-left rounded-xl border p-3 md:p-4 hover:scale-[1.01] transition shadow-sm flex flex-col ${color}`}
              >
                <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
                <div className="font-display text-3xl md:text-4xl mt-auto">{list.length}</div>
                <div className="text-[11px] opacity-70">{list.length === 1 ? "person" : "people"}</div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground text-center mt-3">Higher Performance →</div>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto p-6">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-display">{active}</SheetTitle>
            <SheetDescription>
              {active ? byQuadrant[active]?.length ?? 0 : 0} {active && byQuadrant[active]?.length === 1 ? "person" : "people"} in this segment
            </SheetDescription>
          </SheetHeader>
          <ul className="space-y-3">
            {active && byQuadrant[active]?.map((e) => (
              <li key={e.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="size-9 rounded-full bg-accent/10 text-accent grid place-items-center text-sm font-medium">
                  {e.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-sm">{e.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{e.job_title} · {e.sub_department}</div>
                </div>
                <RagBadge score={e.risk_score} />
              </li>
            ))}
            {active && (byQuadrant[active]?.length ?? 0) === 0 && (
              <li className="text-sm text-muted-foreground text-center py-8">No one in this quadrant.</li>
            )}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}
