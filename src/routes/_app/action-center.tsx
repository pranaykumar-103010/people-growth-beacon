import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Zap, Mail, Plus, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SoWhatFooter } from "@/components/SoWhatFooter";
import { useScope, nameFromEmail } from "@/lib/scope";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { tenureDays } from "@/lib/types";
import type { Employee } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/action-center")({
  component: ActionCenter,
  head: () => ({
    meta: [
      { title: "HRBP Action Center · Talent IQ" },
      { name: "description", content: "Triggered talent interventions with root cause, recommended action and manager follow-up tracking." },
      { property: "og:title", content: "HRBP Action Center · Talent IQ" },
      { property: "og:description", content: "Turn talent signals into tracked HRBP interventions with owners and status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Suggestion = {
  key: string;
  title: string;
  category: string;
  rootCause: string;
  recommended: string;
  emp: Employee;
  severity: 1 | 2 | 3;
};

function buildSuggestions(list: Employee[]): Suggestion[] {
  const out: Suggestion[] = [];
  for (const e of list) {
    if (!e.active || e.exit_date) continue;
    if (e.attrition_risk >= 60 && e.potential_rating >= 3.5 && e.annual_rating >= 3.5) {
      out.push({
        key: `${e.emp_id}-stay`, emp: e, severity: 3, category: "Retention",
        title: `Stay conversation with ${e.name}`,
        rootCause: `High performer (rating ${e.annual_rating}, potential ${e.potential_rating}) at risk score ${e.attrition_risk}${e.flight_risk_drivers?.length ? ` — drivers: ${e.flight_risk_drivers.join(", ")}` : ""}.`,
        recommended: "Run a structured stay interview within 14 days, agree one concrete growth commitment, and log the outcome.",
      });
    } else if (e.attrition_risk >= 60) {
      out.push({
        key: `${e.emp_id}-risk`, emp: e, severity: 2, category: "Retention",
        title: `Risk check-in with ${e.name}`,
        rootCause: `Flight-risk score ${e.attrition_risk} with performance at ${e.annual_rating}.`,
        recommended: "Manager-led check-in on workload, recognition and clarity of the next 6-month scope.",
      });
    }
    if (e.is_critical_role && e.leadership_readiness !== "ready_now" && e.leadership_readiness !== "ready_1y") {
      out.push({
        key: `${e.emp_id}-succession`, emp: e, severity: 3, category: "Succession",
        title: `No successor mapped for ${e.name}'s critical role`,
        rootCause: `Critical role with no ready-now or ready-in-1-year successor identified.`,
        recommended: "Name two bench candidates, start shadowing, and record the plan in succession notes.",
      });
    }
    if (tenureDays(e.joining_date) <= 90 && (e.new_joiner_risk_score ?? 0) >= 50) {
      out.push({
        key: `${e.emp_id}-onboard`, emp: e, severity: 2, category: "Onboarding",
        title: `Onboarding recovery for ${e.name}`,
        rootCause: `New joiner at day ${tenureDays(e.joining_date)} with an onboarding risk score of ${Math.round(e.new_joiner_risk_score ?? 0)}.`,
        recommended: "Reset the 30/60/90 plan with the manager and add a weekly buddy touchpoint for a month.",
      });
    }
    if (e.one_on_one_cadence === "Ad-hoc") {
      out.push({
        key: `${e.emp_id}-cadence`, emp: e, severity: 1, category: "Manager Effectiveness",
        title: `No fixed 1:1 cadence for ${e.name}`,
        rootCause: "1:1 cadence recorded as ad-hoc, which correlates with lower engagement and later risk detection.",
        recommended: `Ask ${nameFromEmail(e.manager_email)} to book a recurring fortnightly 1:1.`,
      });
    }
  }
  return out.sort((a, b) => b.severity - a.severity || b.emp.attrition_risk - a.emp.attrition_risk);
}

const SEV_CLASS: Record<number, string> = {
  3: "bg-rag-red/10 text-rag-red border-rag-red/30",
  2: "bg-rag-amber/15 text-rag-amber border-rag-amber/35",
  1: "bg-accent/10 text-accent border-accent/25",
};

function ActionCenter() {
  const { employees } = useScope();
  const { email } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const suggestions = useMemo(() => buildSuggestions(employees), [employees]);

  const { data: tracked = [] } = useQuery({
    queryKey: ["hrbp_actions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hrbp_actions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const trackedKeys = new Set(tracked.map((t) => `${t.subject_emp_id}-${t.category}`));

  const track = async (s: Suggestion) => {
    setBusy(s.key);
    try {
      const { error } = await supabase.from("hrbp_actions").insert({
        title: s.title,
        category: s.category,
        trigger_type: "auto",
        root_cause: s.rootCause,
        recommended_action: s.recommended,
        subject_emp_id: s.emp.emp_id,
        subject_name: s.emp.name,
        manager_email: s.emp.manager_email,
        assigned_hrbp: email,
        status: "open",
      });
      if (error) throw error;
      toast.success("Action added to the tracker");
      qc.invalidateQueries({ queryKey: ["hrbp_actions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the action");
    } finally { setBusy(null); }
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("hrbp_actions").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["hrbp_actions"] });
  };

  const mailto = (s: Suggestion) =>
    `mailto:${s.emp.manager_email}?subject=${encodeURIComponent(`[Talent IQ] ${s.title}`)}&body=${encodeURIComponent(
      `Hi ${nameFromEmail(s.emp.manager_email)},\n\nContext: ${s.rootCause}\n\nRecommended action: ${s.recommended}\n\nCan we align on this in the next two weeks?\n\n— ${email ?? "HRBP"}`,
    )}`;

  const open = tracked.filter((t) => t.status !== "done");

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-7">
      <header className="space-y-1">
        <div className="text-xs uppercase tracking-widest text-accent font-medium">HRBP Action Center</div>
        <h1 className="font-display text-3xl md:text-4xl">Signals turned into interventions</h1>
        <p className="text-muted-foreground text-sm">
          {suggestions.length} triggered recommendations in scope · {open.length} open in the tracker.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-xl flex items-center gap-2"><Zap className="size-5 text-accent" /> Triggered Recommendations</h2>
        {suggestions.length === 0 && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nothing triggered in this scope. Widen the filters or scope to review more people.</CardContent></Card>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {suggestions.map((s) => (
            <Card key={s.key}>
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm">{s.title}</div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${SEV_CLASS[s.severity]}`}>{s.category}</span>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Root cause</div>
                  <p className="text-sm text-muted-foreground">{s.rootCause}</p>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Recommended action</div>
                  <p className="text-sm">{s.recommended}</p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={busy === s.key || trackedKeys.has(`${s.emp.emp_id}-${s.category}`)} onClick={() => track(s)}>
                    <Plus className="size-3" /> {trackedKeys.has(`${s.emp.emp_id}-${s.category}`) ? "Tracked" : "Track action"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" asChild>
                    <a href={mailto(s)}><Mail className="size-3" /> Nudge manager</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl flex items-center gap-2"><Clock className="size-5 text-accent" /> Action Tracker</h2>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {tracked.map((t) => (
              <div key={t.id} className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.category} · {t.subject_name ?? "—"} · manager {nameFromEmail(t.manager_email)}</div>
                  {t.recommended_action && <p className="text-xs mt-1">{t.recommended_action}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {t.status !== "in_progress" && t.status !== "done" && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setStatus(t.id, "in_progress")}>Start</Button>
                  )}
                  {t.status !== "done" ? (
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setStatus(t.id, "done")}>
                      <CheckCircle2 className="size-3" /> Done
                    </Button>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-rag-green/10 text-rag-green">Closed</span>
                  )}
                </div>
              </div>
            ))}
            {tracked.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">No tracked actions yet.</div>
            )}
          </CardContent>
        </Card>
      </section>

      <SoWhatFooter employees={employees} page="HRBP Action Center" />
    </div>
  );
}
