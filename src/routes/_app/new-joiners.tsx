import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { UserPlus, Loader2, Sparkles } from "lucide-react";
import { useEmployees } from "@/hooks/use-employees";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RagBadge } from "@/components/Rag";
import { tenureDays } from "@/lib/types";
import type { Employee } from "@/lib/types";
import { upsertNewJoinerAssessment } from "@/lib/employees.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/new-joiners")({ component: NewJoiners });

const WINDOW_DAYS = 90;

function NewJoiners() {
  const { isAdmin } = useAuth();
  const { data: employees = [] } = useEmployees();
  const qc = useQueryClient();
  const upsert = useServerFn(upsertNewJoinerAssessment);

  const joiners = useMemo(
    () => employees
      .filter((e) => tenureDays(e.joining_date) <= WINDOW_DAYS)
      .sort((a, b) => tenureDays(a.joining_date) - tenureDays(b.joining_date)),
    [employees],
  );

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-accent font-medium">Onboarding</div>
        <h1 className="font-display text-3xl md:text-4xl flex items-center gap-2">
          <UserPlus className="size-7 text-accent" /> New Joiner Assessment
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Employees within their first {WINDOW_DAYS} days. Risk = 0.5 × (5 − experience) × 20 + 0.5 × (5 − manager) × 20.
        </p>
      </header>

      {joiners.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
          No employees in their first {WINDOW_DAYS} days in your scope.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {joiners.map((e) => (
            <JoinerCard key={e.emp_id} emp={e} isAdmin={isAdmin}
              save={async (exp, mgr) => { await upsert({ data: { emp_id: e.emp_id, exp_feedback: exp, mgr_feedback: mgr } }); qc.invalidateQueries({ queryKey: ["employees"] }); }} />
          ))}
        </div>
      )}
    </div>
  );
}

function JoinerCard({ emp, isAdmin, save }: { emp: Employee; isAdmin: boolean; save: (exp: number, mgr: number) => Promise<void> }) {
  const [exp, setExp] = useState<number>(emp.new_joiner_exp_feedback ?? 3);
  const [mgr, setMgr] = useState<number>(emp.new_joiner_mgr_feedback ?? 3);
  const [busy, setBusy] = useState(false);
  const daysSince = tenureDays(emp.joining_date);
  const risk = Math.round(0.5 * (5 - exp) * 20 + 0.5 * (5 - mgr) * 20);

  const handleSave = async () => {
    setBusy(true);
    try { await save(exp, mgr); toast.success("Assessment saved"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-display text-lg">{emp.name}</div>
            <div className="text-xs text-muted-foreground">{emp.job_title} · {emp.sub_vertical} · {daysSince}d in</div>
          </div>
          <RagBadge score={emp.new_joiner_risk_score ?? risk} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Slider label="Experience" value={exp} onChange={setExp} disabled={!isAdmin} />
          <Slider label="Manager Feedback" value={mgr} onChange={setMgr} disabled={!isAdmin} />
        </div>
        <div className="flex items-center justify-between pt-1 border-t">
          <div className="text-xs text-muted-foreground">
            Live risk: <span className="font-medium text-foreground">{risk}/100</span>
            {emp.new_joiner_risk_score != null && emp.new_joiner_risk_score !== risk && (
              <> · saved: {emp.new_joiner_risk_score}</>
            )}
          </div>
          {isAdmin && (
            <Button size="sm" onClick={handleSave} disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Save
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Slider({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value.toFixed(1)}/5</span>
      </div>
      <input type="range" min={0} max={5} step={0.5} value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent" />
    </div>
  );
}
