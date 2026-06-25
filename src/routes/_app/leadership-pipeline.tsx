import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useEmployees } from "@/hooks/use-employees";
import { Card, CardContent } from "@/components/ui/card";
import { LEADERSHIP_LABEL } from "@/lib/types";
import type { Employee } from "@/lib/types";
import { Crown, Clock, Sparkles, User } from "lucide-react";

export const Route = createFileRoute("/_app/leadership-pipeline")({
  component: LeadershipPipelinePage,
});

const BUCKETS = [
  { key: "ready_now", icon: Crown, tone: "bg-rag-green/10 border-rag-green/30 text-rag-green" },
  { key: "ready_1y", icon: Sparkles, tone: "bg-accent/10 border-accent/30 text-accent" },
  { key: "ready_2y", icon: Clock, tone: "bg-rag-amber/10 border-rag-amber/30 text-rag-amber" },
  { key: "ic_track", icon: User, tone: "bg-secondary border-border text-foreground" },
] as const;

function reason(e: Employee, k: string): string {
  if (k === "ready_now") return `Perf ${e.h2_rating} · Pot ${e.potential_rating} · proven tenure`;
  if (k === "ready_1y") return `Perf ${e.h2_rating} · Pot ${e.potential_rating} · stretch this year`;
  if (k === "ready_2y") return `Pot ${e.potential_rating} · needs broader experience`;
  return "Strong IC contribution path";
}

function LeadershipPipelinePage() {
  const { data: employees = [] } = useEmployees();
  const byBucket = useMemo(() => {
    const m: Record<string, Employee[]> = { ready_now: [], ready_1y: [], ready_2y: [], ic_track: [] };
    for (const e of employees) {
      const k = e.leadership_readiness ?? "ic_track";
      (m[k] ?? m.ic_track).push(e);
    }
    return m;
  }, [employees]);

  // AI readiness distribution
  const aiDist = useMemo(() => {
    const m: Record<string, number> = { "AI Champion": 0, "AI Ready": 0, "AI Learner": 0, "AI Beginner": 0 };
    for (const e of employees) { const b = e.ai_readiness_band ?? "AI Beginner"; m[b] = (m[b] || 0) + 1; }
    return m;
  }, [employees]);

  const total = employees.length || 1;
  const aiScoreAvg = Math.round(employees.reduce((s, e) => s + (e.ai_readiness_score ?? 0), 0) / total);

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-accent font-medium">Succession + AI Readiness</div>
        <h1 className="font-display text-3xl md:text-4xl">Leadership Pipeline</h1>
        <p className="text-muted-foreground text-sm mt-1">Who's ready to step up — and how AI-ready the team is.</p>
      </header>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-lg">AI Readiness Index</h2>
            <div className="text-sm text-muted-foreground">Org average <span className="font-medium text-foreground">{aiScoreAvg}/100</span></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(aiDist).map(([band, n]) => (
              <div key={band} className="rounded-lg border p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{band}</div>
                <div className="font-display text-2xl mt-1">{n}</div>
                <div className="h-1.5 mt-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${(n / total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {BUCKETS.map(({ key, icon: Icon, tone }) => {
          const list = byBucket[key];
          return (
            <Card key={key}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`size-9 rounded-lg grid place-items-center border ${tone}`}>
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <div className="font-display text-base">{LEADERSHIP_LABEL[key]}</div>
                      <div className="text-xs text-muted-foreground">{list.length} {list.length === 1 ? "person" : "people"}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {list.length === 0 && <div className="text-sm text-muted-foreground">Nobody in this bucket yet.</div>}
                  {list.map((e) => (
                    <div key={e.emp_id} className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/50">
                      <div className="size-8 rounded-full bg-accent/10 text-accent grid place-items-center text-xs font-medium">
                        {e.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{e.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{e.job_title} · {reason(e, key)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
