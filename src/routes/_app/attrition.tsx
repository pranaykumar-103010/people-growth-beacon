import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Lock } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { useEmployees } from "@/hooks/use-employees";
import { analyzeOneOnOneNote } from "@/lib/ai.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RagBadge } from "@/components/Rag";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Employee } from "@/lib/types";

export const Route = createFileRoute("/_app/attrition")({
  component: AttritionRadar,
});

function NotesPanel({ employee }: { employee: Employee }) {
  const { isAdmin } = useAuth();
  const analyze = useServerFn(analyzeOneOnOneNote);
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: notes = [] } = useQuery({
    queryKey: ["hrbp_notes", employee.id],
    queryFn: async () => {
      if (!isAdmin) return [];
      const { data, error } = await supabase
        .from("hrbp_notes").select("*")
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const submit = async () => {
    if (note.trim().length < 10) { toast.error("Note too short"); return; }
    setBusy(true);
    try {
      const res = await analyze({ data: { employeeId: employee.id, note } });
      toast.success(`Risk now ${res.risk_score} · ${res.nine_box_quadrant}`);
      setNote("");
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["hrbp_notes", employee.id] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground flex items-center gap-2">
        <Lock className="size-3.5" /> HRBP Insight notes are visible to HRBP Admins only.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-accent" /> HRBP Insight · 1-on-1 note
        </div>
        <Textarea
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Karan mentioned he's been feeling burned out by sprint deadlines and is exploring external roles for more growth…"
          className="min-h-24"
        />
        <Button onClick={submit} disabled={busy} size="sm" className="gap-1.5">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          Analyze & update risk
        </Button>
      </div>
      {notes.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Past notes</div>
          {notes.map((n: any) => (
            <div key={n.id} className="text-xs border rounded p-2.5 bg-secondary/40">
              <div className="text-muted-foreground mb-1">{new Date(n.created_at).toLocaleDateString()}</div>
              <div className="whitespace-pre-wrap">{n.note}</div>
              {n.ai_summary && <div className="mt-1.5 pt-1.5 border-t text-accent italic">{n.ai_summary}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AttritionRadar() {
  const { data: employees = [], isLoading } = useEmployees();

  const driverData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of employees) for (const d of e.risk_drivers) counts[d] = (counts[d] ?? 0) + 1;
    return Object.entries(counts)
      .map(([driver, count]) => ({ driver, count }))
      .sort((a, b) => b.count - a.count);
  }, [employees]);

  const sorted = [...employees].sort((a, b) => b.risk_score - a.risk_score);

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-accent font-medium">Attrition Radar</div>
        <h1 className="font-display text-3xl md:text-4xl">Risk trends & key drivers</h1>
      </header>

      <Card>
        <CardContent className="p-5">
          <div className="text-sm font-medium mb-3">Top risk drivers across team</div>
          {driverData.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No risk drivers tagged yet.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={driverData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" stroke="oklch(0.48 0.04 255)" fontSize={12} />
                  <YAxis dataKey="driver" type="category" stroke="oklch(0.48 0.04 255)" fontSize={12} width={140} />
                  <Tooltip cursor={{ fill: "oklch(0.95 0.015 250)" }}
                    contentStyle={{ background: "white", border: "1px solid oklch(0.91 0.013 250)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {driverData.map((_, i) => (
                      <Cell key={i} fill="oklch(0.48 0.09 255)" />
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
        {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> :
          sorted.map((e) => (
            <Card key={e.id} id={e.id}>
              <CardContent className="p-5 grid md:grid-cols-[1fr_320px] gap-5">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-lg">{e.name}</div>
                      <div className="text-xs text-muted-foreground">{e.job_title} · {e.sub_department}</div>
                    </div>
                    <RagBadge score={e.risk_score} />
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div><div className="text-muted-foreground">Performance</div><div className="font-medium text-sm">{e.performance_rating}/5</div></div>
                    <div><div className="text-muted-foreground">Potential</div><div className="font-medium text-sm">{e.potential_rating}/5</div></div>
                    <div><div className="text-muted-foreground">9-Box</div><div className="font-medium text-sm">{e.nine_box_quadrant}</div></div>
                  </div>
                  {e.risk_drivers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {e.risk_drivers.map((d) => (
                        <span key={d} className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-rag-red/10 text-rag-red border border-rag-red/20">{d}</span>
                      ))}
                    </div>
                  )}
                </div>
                <NotesPanel employee={e} />
              </CardContent>
            </Card>
          ))
        }
      </section>
    </div>
  );
}
