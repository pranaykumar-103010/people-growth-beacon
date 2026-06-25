import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useEmployees } from "@/hooks/use-employees";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TALENT_SEGMENTS, SEGMENT_TONE } from "@/lib/types";
import type { Employee } from "@/lib/types";
import { RagBadge } from "@/components/Rag";

export const Route = createFileRoute("/_app/talent-segments")({
  component: TalentSegmentsPage,
});

const TONE_CLASS: Record<string, string> = {
  good: "border-rag-green/40 bg-rag-green/5",
  warning: "border-rag-amber/40 bg-rag-amber/5",
  danger: "border-rag-red/40 bg-rag-red/5",
  default: "border-border bg-card",
};

function TalentSegmentsPage() {
  const { data: employees = [] } = useEmployees();
  const [segment, setSegment] = useState<string | null>(null);

  const bySeg = useMemo(() => {
    const m: Record<string, Employee[]> = {};
    for (const s of TALENT_SEGMENTS) m[s] = [];
    for (const e of employees) {
      const s = e.talent_segment || "Solid Contributors";
      if (m[s]) m[s].push(e); else (m[s] = [e]);
    }
    return m;
  }, [employees]);

  const list = segment ? bySeg[segment] ?? [] : [];

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-accent font-medium">Performance × Risk</div>
        <h1 className="font-display text-3xl md:text-4xl">Talent Segments</h1>
        <p className="text-muted-foreground text-sm mt-1">Nine intelligent segments combining performance, potential, and attrition risk. Click any tile to drill in.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TALENT_SEGMENTS.map((s) => {
          const count = bySeg[s].length;
          const tone = SEGMENT_TONE[s] ?? "default";
          return (
            <button key={s} onClick={() => setSegment(s)}
              className={`text-left border rounded-xl p-5 transition hover:shadow-md hover:-translate-y-0.5 ${TONE_CLASS[tone]} ${count === 0 ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="font-display text-lg">{s}</div>
                <div className="font-display text-2xl">{count}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{descFor(s)}</div>
            </button>
          );
        })}
      </div>

      <Sheet open={!!segment} onOpenChange={(o) => !o && setSegment(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-display">{segment} · {list.length}</SheetTitle>
          </SheetHeader>
          <div className="space-y-2">
            {list.length === 0 && <p className="text-sm text-muted-foreground">No employees in this segment.</p>}
            {list.map((e) => (
              <Card key={e.emp_id}><CardContent className="p-3 flex items-center gap-3">
                <div className="size-9 rounded-full bg-accent/10 text-accent grid place-items-center text-xs font-medium">
                  {e.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{e.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{e.job_title} · {e.sub_vertical}</div>
                </div>
                <RagBadge score={e.attrition_risk} />
              </CardContent></Card>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function descFor(s: string): string {
  switch (s) {
    case "Future Leaders": return "High performance + high potential. Invest, stretch, succession.";
    case "Core Talent": return "Strong performers. Recognize and retain.";
    case "Emerging Talent": return "High potential, low risk. Accelerate growth.";
    case "Watch List": return "Steady performers showing risk signals. Monitor.";
    case "Retention Priority": return "Top performers at risk. Act this month.";
    case "Solid Contributors": return "Dependable steady state. Keep engaged.";
    case "Performance Concern": return "Below bar. Coach or rebalance.";
    case "Flight Risk Stars": return "Star talent likely to leave. Urgent stay conversation.";
    case "Critical Intervention": return "Compounded risk. HRBP intervention required.";
    default: return "";
  }
}
