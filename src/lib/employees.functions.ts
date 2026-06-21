import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RowSchema = z.object({
  emp_id: z.string().min(1),
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  job_title: z.string().optional().nullable(),
  level: z.string().optional().nullable(),
  department: z.string().optional(),
  sub_vertical: z.string().optional().nullable(),
  joining_date: z.string().optional(),
  h2_rating: z.number().min(1).max(5).optional(),
  potential_rating: z.number().min(1).max(5).optional(),
  manager_email: z.string().email().optional(),
  rollup_manager_email: z.string().email().optional().nullable(),
  function_head_email: z.string().email().optional().nullable(),
  attrition_risk: z.number().int().min(0).max(100).optional(),
  rag_status: z.enum(["green", "amber", "red"]).optional(),
  succession_notes: z.string().optional().nullable(),
  future_career_path: z.string().optional().nullable(),
  hrbp_insights: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

const Input = z.object({ rows: z.array(RowSchema).min(1).max(2000) });

function quadrant(perf: number, pot: number): string {
  const pb = perf >= 3.5 ? "H" : perf >= 2.5 ? "M" : "L";
  const ob = pot >= 3.5 ? "H" : pot >= 2.5 ? "M" : "L";
  const m: Record<string, string> = {
    HH: "Star", MH: "Key Player", LH: "Question Mark",
    HM: "High Performer", MM: "Core Player", LM: "Inconsistent",
    HL: "Risk", ML: "Solid Performer", LL: "Iceberg",
  };
  return m[pb + ob];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "hrbp_admin" });
  if (!data) throw new Error("Forbidden — admin only");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function actorEmail(supabase: any): Promise<string> {
  const { data } = await supabase.rpc("current_user_email");
  return String(data ?? "unknown");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mw = [requireSupabaseAuth as any] as any;

export const upsertEmployees = createServerFn({ method: "POST" })
  .middleware(mw)
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { supabase, userId } = context as unknown as { supabase: any; userId: string };
    await ensureAdmin(supabase, userId);
    const actor = await actorEmail(supabase);

    const ids = data.rows.map((r) => r.emp_id);
    const { data: existing } = await supabase.from("employees").select("*").in("emp_id", ids);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byId = new Map<string, any>((existing ?? []).map((e: any) => [e.emp_id, e]));
    const existingIds = new Set(byId.keys());

    const merged = data.rows.map((row) => {
      const prev = byId.get(row.emp_id) ?? {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const next: any = { ...prev, ...row };
      if (!next.name) next.name = prev.name ?? row.emp_id;
      if (!next.manager_email) next.manager_email = prev.manager_email ?? "unassigned@flick2know.com";
      if (next.department == null) next.department = "Technology";
      if (next.joining_date == null) next.joining_date = new Date().toISOString().slice(0, 10);
      if (next.active == null) next.active = true;
      if (next.h2_rating == null) next.h2_rating = prev.h2_rating ?? 3;
      if (next.potential_rating == null) next.potential_rating = prev.potential_rating ?? 3;
      next.h2_rating = Math.max(1, Math.min(5, Number(next.h2_rating)));
      next.potential_rating = Math.max(1, Math.min(5, Number(next.potential_rating)));
      next.nine_box_quadrant = quadrant(Number(next.h2_rating), Number(next.potential_rating));
      if (next.attrition_risk == null) next.attrition_risk = prev.attrition_risk ?? 0;
      if (next.rag_status == null) {
        const r = Number(next.attrition_risk);
        next.rag_status = r >= 65 ? "red" : r >= 40 ? "amber" : "green";
      }
      delete next.created_at; delete next.updated_at;
      return next;
    });

    const { data: out, error } = await supabase
      .from("employees")
      .upsert(merged, { onConflict: "emp_id" })
      .select("emp_id");
    if (error) throw new Error(error.message);

    const inserted = merged.filter((m) => !existingIds.has(m.emp_id)).length;
    const updated = (out?.length ?? 0) - inserted;

    // Audit log: one row per upload summary
    await supabase.from("audit_log").insert({
      actor_email: actor,
      emp_id: "BULK",
      field: "bulk_upsert",
      old_value: null,
      new_value: `inserted=${inserted}; updated=${updated}; ids=${ids.slice(0, 50).join(",")}${ids.length > 50 ? "…" : ""}`,
    });

    return { count: out?.length ?? 0, inserted, updated };
  });

export const updateEmployeeField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    emp_id: z.string().min(1),
    patch: z.record(z.string(), z.any()),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { supabase, userId } = context as unknown as { supabase: any; userId: string };
    await ensureAdmin(supabase, userId);
    const actor = await actorEmail(supabase);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: any = { ...data.patch };
    delete patch.emp_id; delete patch.created_at; delete patch.updated_at;

    // Validation
    if (patch.h2_rating != null) patch.h2_rating = Math.max(1, Math.min(5, Number(patch.h2_rating)));
    if (patch.potential_rating != null) patch.potential_rating = Math.max(1, Math.min(5, Number(patch.potential_rating)));
    if (patch.attrition_risk != null) patch.attrition_risk = Math.max(0, Math.min(100, Math.round(Number(patch.attrition_risk))));
    if (patch.rag_status != null && !["green", "amber", "red"].includes(String(patch.rag_status))) {
      throw new Error("Invalid RAG status");
    }
    for (const k of ["email", "manager_email", "rollup_manager_email", "function_head_email"]) {
      if (patch[k] != null && patch[k] !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(patch[k]))) {
        throw new Error(`Invalid email for ${k}`);
      }
    }

    // Fetch old values for audit
    const fields = Object.keys(patch);
    const { data: cur } = await supabase
      .from("employees")
      .select([...fields, "h2_rating", "potential_rating"].join(","))
      .eq("emp_id", data.emp_id)
      .maybeSingle();

    if (patch.h2_rating != null || patch.potential_rating != null) {
      const h = Number(patch.h2_rating ?? cur?.h2_rating ?? 3);
      const p = Number(patch.potential_rating ?? cur?.potential_rating ?? 3);
      patch.nine_box_quadrant = quadrant(h, p);
    }
    if (patch.attrition_risk != null && patch.rag_status == null) {
      const r = Number(patch.attrition_risk);
      patch.rag_status = r >= 65 ? "red" : r >= 40 ? "amber" : "green";
    }

    const { error } = await supabase.from("employees").update(patch).eq("emp_id", data.emp_id);
    if (error) throw new Error(error.message);

    // Audit each changed field
    const auditRows = fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((f) => String((cur as any)?.[f] ?? "") !== String(patch[f] ?? ""))
      .map((f) => ({
        actor_email: actor,
        emp_id: data.emp_id,
        field: f,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        old_value: (cur as any)?.[f] == null ? null : String((cur as any)[f]),
        new_value: patch[f] == null ? null : String(patch[f]),
      }));
    if (auditRows.length) await supabase.from("audit_log").insert(auditRows);

    return { ok: true, changed: auditRows.length };
  });
