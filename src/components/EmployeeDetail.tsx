import { useState } from "react";
import { Brain, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { RagBadge } from "@/components/Rag";
import { LEADERSHIP_LABEL } from "@/lib/types";
import type { Employee } from "@/lib/types";
import { generateEmployeeInsight } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-secondary/60 p-2 text-center">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</div>
      <div className="font-display text-base">{value}</div>
    </div>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">{children}</span>;
}
function Block({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="whitespace-pre-wrap text-sm">{value}</div>
    </div>
  );
}

export function EmployeeDetail({ employee, onClose, onRegenerated }: {
  employee: Employee | null;
  onClose: () => void;
  onRegenerated: () => void;
}) {
  const generate = useServerFn(generateEmployeeInsight);
  const [busy, setBusy] = useState(false);

  const handleRegen = async () => {
    if (!employee) return;
    setBusy(true);
    try {
      await generate({ data: { emp_id: employee.emp_id } });
      toast.success("AI insight refreshed");
      onRegenerated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate insight");
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={!!employee} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6">
        {employee && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="font-display flex items-center gap-2 flex-wrap">
                {employee.name}
                <RagBadge score={employee.attrition_risk} />
              </SheetTitle>
              <SheetDescription>{employee.job_title} · {employee.sub_vertical}</SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-4 gap-2 text-xs mb-4">
              <Stat label="Annual" value={employee.annual_rating} />
              <Stat label="Potential" value={employee.potential_rating} />
              <Stat label="Risk" value={employee.attrition_risk} />
              <Stat label="AI Idx" value={employee.ai_readiness_score ?? "—"} />
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {employee.talent_segment && <Chip>{employee.talent_segment}</Chip>}
              {employee.leadership_readiness && <Chip>{LEADERSHIP_LABEL[employee.leadership_readiness]}</Chip>}
              {employee.ai_readiness_band && <Chip>{employee.ai_readiness_band}</Chip>}
              {employee.is_critical_role && <Chip>Critical Role</Chip>}
              {employee.location && <Chip>{employee.location}</Chip>}
            </div>

            <div className="rounded-lg border bg-card p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Brain className="size-3.5" /> AI HRBP Insight
                </div>
                <Button size="sm" variant="ghost" disabled={busy} onClick={handleRegen} className="h-7 gap-1.5 text-xs">
                  <RefreshCw className={`size-3 ${busy ? "animate-spin" : ""}`} /> Regenerate
                </Button>
              </div>
              <p className="text-sm whitespace-pre-wrap">{employee.hrbp_insights ?? "No insight yet. Click Regenerate."}</p>
            </div>

            {employee.flight_risk_drivers && employee.flight_risk_drivers.length > 0 && (
              <div className="mb-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Top Flight-Risk Drivers</div>
                <div className="flex flex-wrap gap-1.5">
                  {employee.flight_risk_drivers.map((d) => (
                    <span key={d} className="text-xs px-2.5 py-1 rounded-full bg-rag-red/10 text-rag-red border border-rag-red/20">{d}</span>
                  ))}
                </div>
              </div>
            )}

            {employee.ai_recommended_actions && employee.ai_recommended_actions.length > 0 && (
              <div className="mb-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Recommended Actions · 30-60 days</div>
                <ul className="space-y-1.5">
                  {employee.ai_recommended_actions.map((a, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="size-5 rounded-full bg-accent/10 text-accent grid place-items-center text-[10px] font-medium flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-3 text-sm pt-3 border-t">
              <Block label="Manager" value={employee.manager_email} />
              <Block label="Roll-up Manager" value={employee.rollup_manager_email ?? "—"} />
              <Block label="Function Head" value={employee.function_head_email ?? "—"} />
              <Block label="1:1 Cadence" value={employee.one_on_one_cadence ?? "Not tracked"} />
              <Block label="Succession · Next Steps" value={employee.succession_notes ?? "Not set."} />
              <Block label="Future Career Path" value={employee.future_career_path ?? "Not set."} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
