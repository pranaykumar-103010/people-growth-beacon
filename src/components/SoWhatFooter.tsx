import { useMemo } from "react";
import { Compass } from "lucide-react";
import type { Employee } from "@/lib/types";
import { tenureDays } from "@/lib/types";
import { nameFromEmail } from "@/lib/scope";

const REPLACEMENT_COST_PER_HEAD_LAKH = 7; // ~50% of loaded annual cost, ₹L

type Insight = { observation: string; rootCause: string; impact: string; action: string };

function build(employees: Employee[], page: string): Insight {
  const onRoll = employees.filter((e) => e.active && !e.exit_date);
  if (onRoll.length === 0) {
    return {
      observation: `No employees currently in scope on ${page}.`,
      rootCause: "Filters may be too narrow, or your reporting line has no active members.",
      impact: "Decisions on this page cannot be evidenced.",
      action: "Clear the global filters or switch the role scope to widen the population.",
    };
  }

  // Worst sub-department by share of high flight risk
  const bySub = new Map<string, Employee[]>();
  for (const e of onRoll) {
    const k = e.sub_vertical ?? "Unmapped";
    bySub.set(k, [...(bySub.get(k) ?? []), e]);
  }
  const ranked = Array.from(bySub.entries())
    .filter(([, list]) => list.length >= 2)
    .map(([sub, list]) => ({
      sub,
      list,
      riskPct: Math.round((list.filter((e) => e.attrition_risk >= 60).length / list.length) * 100),
      avgRating: list.reduce((s, e) => s + e.annual_rating, 0) / list.length,
    }))
    .sort((a, b) => b.riskPct - a.riskPct);

  const worst = ranked[0] ?? {
    sub: onRoll[0].sub_vertical ?? "Unmapped",
    list: onRoll,
    riskPct: Math.round((onRoll.filter((e) => e.attrition_risk >= 60).length / onRoll.length) * 100),
    avgRating: onRoll.reduce((s, e) => s + e.annual_rating, 0) / onRoll.length,
  };

  const atRisk = worst.list.filter((e) => e.attrition_risk >= 60);
  const noPromo = worst.list.filter((e) => !e.promotion_effective_date && tenureDays(e.joining_date) > 540).length;
  const stale1on1 = worst.list.filter((e) => e.one_on_one_cadence === "Monthly" || e.one_on_one_cadence === "Ad-hoc").length;
  const mgrCounts = new Map<string, number>();
  for (const e of worst.list) {
    const m = (e.manager_email ?? "").toLowerCase();
    mgrCounts.set(m, (mgrCounts.get(m) ?? 0) + 1);
  }
  const widest = Array.from(mgrCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  const hipoAtRisk = atRisk.filter((e) => e.potential_rating >= 3.5).length;

  return {
    observation: `${worst.sub} carries the highest flight-risk concentration in scope — ${worst.riskPct}% of its ${worst.list.length} people sit at risk score ≥ 60, with an average performance rating of ${worst.avgRating.toFixed(2)}.`,
    rootCause: [
      noPromo > 0 ? `${noPromo} people past 18 months with no recorded promotion` : null,
      widest && widest[1] >= 8 ? `${nameFromEmail(widest[0])} carries a span of ${widest[1]} direct reports` : null,
      stale1on1 > 0 ? `${stale1on1} on monthly or ad-hoc 1:1 cadence` : null,
      hipoAtRisk > 0 ? `${hipoAtRisk} high-potential employees inside the risk pool` : null,
    ].filter(Boolean).join(" · ") || "Risk is spread evenly; no single structural driver dominates.",
    impact: `Losing the ${atRisk.length} at-risk ${atRisk.length === 1 ? "person" : "people"} would cost an estimated ₹${(atRisk.length * REPLACEMENT_COST_PER_HEAD_LAKH).toFixed(0)}L in replacement and ramp, plus roadmap slippage in ${worst.sub}.`,
    action: [
      hipoAtRisk > 0 ? "Run stay interviews with high-potential at-risk employees inside 2 weeks" : "Run pulse check-ins with the at-risk cohort",
      noPromo > 0 ? "trigger an off-cycle promotion / role-scope review" : "confirm career-path conversations are logged",
      widest && widest[1] >= 8 ? "layer the widest management span" : "hold cadence at fortnightly 1:1s",
    ].join(", ") + ".",
  };
}

export function SoWhatFooter({ employees, page }: { employees: Employee[]; page: string }) {
  const i = useMemo(() => build(employees, page), [employees, page]);
  const rows: [string, string][] = [
    ["Observation", i.observation],
    ["Root Cause", i.rootCause],
    ["Business Impact", i.impact],
    ["Recommended HRBP Action", i.action],
  ];
  return (
    <section className="rounded-xl border border-accent/25 bg-accent/[0.04] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Compass className="size-4 text-accent" />
        <h2 className="font-display text-lg">So What? → Now What?</h2>
        <span className="text-[11px] text-muted-foreground ml-auto">{page}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map(([label, text]) => (
          <div key={label} className="rounded-lg bg-card border p-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
            <p className="text-sm leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
