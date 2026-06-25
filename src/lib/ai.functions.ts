import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InsightSchema = z.object({
  insight: z.string().min(10).max(500),
  recommended_actions: z.array(z.string().min(3).max(160)).min(2).max(5),
  flight_risk_drivers: z.array(z.string()).max(3),
  retention_risk_band: z.enum(["low", "medium", "high", "critical"]),
});

const ALLOWED_DRIVERS = [
  "Career Growth", "Compensation", "Workload", "Manager Dependency",
  "Lack of Recognition", "Skill Stagnation", "Internal Mobility", "Leadership Gap",
];

export const generateEmployeeInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ emp_id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { supabase } = context as unknown as { supabase: any };
    const { data: emp, error } = await supabase
      .from("employees").select("*").eq("emp_id", data.emp_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!emp) throw new Error("Employee not found or not visible");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const { generateText, Output } = await import("ai");
    const gateway = createLovableAiGatewayProvider(key);

    const tenureYrs = ((Date.now() - new Date(emp.joining_date).getTime()) / (365 * 86400000)).toFixed(1);
    const profile = `Name: ${emp.name}
Role: ${emp.job_title} (${emp.level}) · ${emp.department} / ${emp.sub_vertical ?? "—"}
Tenure: ${tenureYrs} years
H2 Performance: ${emp.h2_rating}/5 · Potential: ${emp.potential_rating}/5
Current attrition risk: ${emp.attrition_risk}/100 · 9-Box: ${emp.nine_box_quadrant}
Talent segment: ${emp.talent_segment ?? "—"} · Leadership readiness: ${emp.leadership_readiness ?? "—"}
Existing HRBP notes: ${emp.hrbp_insights ?? "none"}`;

    const driversList = ALLOWED_DRIVERS.join(", ");

    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      output: Output.object({ schema: InsightSchema }),
      system: "You are a senior HRBP advisor at a B2B SaaS company (FieldAssist). Write concise, business-focused, actionable insights. Avoid generic HR-speak.",
      prompt: `Generate an HRBP insight for this employee.
${profile}

Rules:
- "insight": 2-3 sentences, human, business-focused, actionable.
- "recommended_actions": 3-4 simple, low-effort, high-impact actions implementable in 30-60 days.
- "flight_risk_drivers": top 3 likely drivers chosen ONLY from: ${driversList}. If risk is low (<40), return [].
- "retention_risk_band": one of low/medium/high/critical based on risk + signals.`,
    });

    const drivers = (output.flight_risk_drivers || []).filter((d) => ALLOWED_DRIVERS.includes(d)).slice(0, 3);

    const { error: upErr } = await supabase.from("employees").update({
      hrbp_insights: output.insight,
      ai_recommended_actions: output.recommended_actions,
      flight_risk_drivers: drivers,
      retention_risk_band: output.retention_risk_band,
      ai_insight_generated_at: new Date().toISOString(),
    }).eq("emp_id", data.emp_id);
    if (upErr) throw new Error(upErr.message);

    return { ...output, flight_risk_drivers: drivers };
  });

const DeptSchema = z.object({
  strengths: z.array(z.string()).min(2).max(4),
  risks: z.array(z.string()).min(2).max(4),
  actions: z.array(z.string()).min(2).max(3),
  summary: z.string().min(20).max(400),
});

export const generateDepartmentInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ department: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { supabase } = context as unknown as { supabase: any };
    const { data: rows, error } = await supabase
      .from("employees").select("name,job_title,level,sub_vertical,h2_rating,potential_rating,attrition_risk,talent_segment,nine_box_quadrant,hrbp_insights")
      .eq("department", data.department).eq("active", true);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("No visible employees in that department");

    const total = rows.length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const avg = (k: string) => (rows.reduce((s: number, r: any) => s + Number(r[k] ?? 0), 0) / total).toFixed(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stars = rows.filter((r: any) => r.nine_box_quadrant === "Star").length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const highRisk = rows.filter((r: any) => Number(r.attrition_risk) >= 65).length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const segDist = rows.reduce((acc: Record<string, number>, r: any) => {
      const s = r.talent_segment ?? "Unsegmented"; acc[s] = (acc[s] || 0) + 1; return acc;
    }, {});

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const { generateText, Output } = await import("ai");
    const gateway = createLovableAiGatewayProvider(key);

    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      output: Output.object({ schema: DeptSchema }),
      system: "You are a senior HRBP advisor. Be concrete, business-focused, and actionable.",
      prompt: `Department: ${data.department}
Headcount (visible): ${total}
Avg H2 performance: ${avg("h2_rating")}  ·  Avg potential: ${avg("potential_rating")}
Avg attrition risk: ${avg("attrition_risk")}/100
High-risk employees (>=65): ${highRisk}
Stars (high perf + high pot): ${stars}
Segment distribution: ${JSON.stringify(segDist)}

Generate department-level HRBP insight:
- "strengths": 2-3 specific strengths grounded in this data.
- "risks": 2-3 specific risks grounded in this data.
- "actions": up to 3 practical recommendations a HRBP could execute in 30-60 days.
- "summary": 2-3 sentence executive summary.`,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actor = await supabase.rpc("current_user_email").then((r: any) => String(r.data ?? "system"));
    const { error: upErr } = await supabase.from("department_insights").upsert({
      department: data.department,
      strengths: output.strengths,
      risks: output.risks,
      actions: output.actions,
      summary: output.summary,
      generated_by: actor,
      updated_at: new Date().toISOString(),
    }, { onConflict: "department" });
    if (upErr) throw new Error(upErr.message);

    return output;
  });

export const listDepartmentInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { supabase } = context as unknown as { supabase: any };
    const { data, error } = await supabase.from("department_insights").select("*").order("department");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
