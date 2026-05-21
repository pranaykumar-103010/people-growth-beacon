import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway";

const MODEL = "google/gemini-3-flash-preview";

function getModel() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return createLovableAiGatewayProvider(key)(MODEL);
}

/* ---------- Suggest stay conversation questions ---------- */
export const suggestStayQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ employeeId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: emp, error } = await supabase
      .from("employees")
      .select("name, job_title, sub_department, risk_score, risk_drivers, nine_box_quadrant, performance_rating")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (error || !emp) throw new Error("Employee not found");

    const model = getModel();
    const { text } = await generateText({
      model,
      system:
        "You are an experienced HR Business Partner coach. Generate empathetic, open-ended 'stay conversation' questions a manager can ask an at-risk employee. Avoid generic questions. Address the specific drivers.",
      prompt: `Employee: ${emp.name} — ${emp.job_title ?? "Engineer"} in ${emp.sub_department}.
Risk score: ${emp.risk_score}/100.
9-box quadrant: ${emp.nine_box_quadrant}.
Performance: ${emp.performance_rating}/5.
Known risk drivers: ${(emp.risk_drivers ?? []).join(", ") || "unspecified"}.

Generate exactly 6 stay-conversation questions tailored to this profile. Return as a markdown numbered list. After the list, add a short "Tone tips" section with 2 bullet points.`,
    });
    return { content: text };
  });

/* ---------- Analyze 1-on-1 notes -> update risk + 9-box ---------- */
const RISK_KEYWORDS: Record<string, number> = {
  burnout: 25, "burn out": 25, exhausted: 18, overworked: 18,
  "competing offer": 30, "another offer": 30, leaving: 25, quit: 25, resign: 30,
  compensation: 15, salary: 15, underpaid: 20,
  "career growth": 12, stagnant: 15, bored: 12, "no growth": 18,
  "manager relationship": 18, "manager conflict": 22, micromanage: 15,
  workload: 12, deadlines: 10, "role clarity": 10,
  recognition: 8, "not appreciated": 12,
};

function ruleBasedRisk(note: string): { delta: number; drivers: string[] } {
  const lower = note.toLowerCase();
  let delta = 0;
  const drivers = new Set<string>();
  for (const [kw, weight] of Object.entries(RISK_KEYWORDS)) {
    if (lower.includes(kw)) {
      delta += weight;
      // normalize to a clean driver label
      drivers.add(
        kw.includes("offer") ? "competing offer"
        : kw.includes("burn") ? "burnout"
        : kw.includes("compensation") || kw.includes("salary") || kw.includes("underpaid") ? "compensation"
        : kw.includes("growth") || kw.includes("stagnant") || kw.includes("bored") ? "career growth"
        : kw.includes("manager") || kw.includes("micromanage") ? "manager relationship"
        : kw.includes("workload") || kw.includes("overworked") || kw.includes("deadlines") ? "workload"
        : kw.includes("recognition") || kw.includes("appreciated") ? "recognition"
        : "role clarity",
      );
    }
  }
  return { delta: Math.min(delta, 60), drivers: [...drivers] };
}

export const analyzeOneOnOneNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      employeeId: z.string().uuid(),
      note: z.string().min(10).max(5000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: emp, error } = await supabase
      .from("employees")
      .select("id, name, risk_score, nine_box_quadrant, performance_rating, potential_rating, risk_drivers")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (error || !emp) throw new Error("Employee not found");

    const base = ruleBasedRisk(data.note);

    // LLM refines: returns JSON with adjustments
    const model = getModel();
    let llmRiskScore = Math.min(100, emp.risk_score + base.delta);
    let llmQuadrant = emp.nine_box_quadrant;
    let llmDrivers = Array.from(new Set([...(emp.risk_drivers ?? []), ...base.drivers]));
    let llmSummary = "";

    try {
      const { text } = await generateText({
        model,
        system:
          "You are an HR analytics engine. Read a 1-on-1 note and output JSON only with keys: risk_score (0-100 integer), nine_box_quadrant (one of: Star, High Performer, Core Player, Question Mark, Key Player, Solid Performer, Risk, Inconsistent, Iceberg), drivers (array of short driver labels), summary (1-2 sentence neutral summary). No markdown, JSON only.",
        prompt: `Current state for ${emp.name}:
- risk_score: ${emp.risk_score}
- nine_box_quadrant: ${emp.nine_box_quadrant}
- performance_rating: ${emp.performance_rating}/5
- potential_rating: ${emp.potential_rating}/5
- existing drivers: ${(emp.risk_drivers ?? []).join(", ") || "none"}

Keyword-based suggested delta: +${base.delta} risk; new drivers detected: ${base.drivers.join(", ") || "none"}.

1-on-1 note:
"""
${data.note}
"""

Produce updated values reflecting this conversation. Be calibrated; small notes -> small adjustments.`,
      });
      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (typeof parsed.risk_score === "number")
        llmRiskScore = Math.max(0, Math.min(100, Math.round(parsed.risk_score)));
      if (typeof parsed.nine_box_quadrant === "string") llmQuadrant = parsed.nine_box_quadrant;
      if (Array.isArray(parsed.drivers)) llmDrivers = parsed.drivers.slice(0, 6).map(String);
      if (typeof parsed.summary === "string") llmSummary = parsed.summary;
    } catch (e) {
      console.error("AI parse failed, falling back to rules", e);
    }

    const { error: updErr } = await supabase
      .from("employees")
      .update({
        risk_score: llmRiskScore,
        nine_box_quadrant: llmQuadrant,
        risk_drivers: llmDrivers,
        last_analyzed_at: new Date().toISOString(),
      })
      .eq("id", data.employeeId);
    if (updErr) throw new Error(updErr.message);

    const { error: noteErr } = await supabase.from("hrbp_notes").insert({
      employee_id: data.employeeId,
      author_id: userId,
      note: data.note,
      ai_summary: llmSummary,
    });
    if (noteErr) console.error(noteErr);

    return {
      risk_score: llmRiskScore,
      nine_box_quadrant: llmQuadrant,
      drivers: llmDrivers,
      summary: llmSummary,
    };
  });
