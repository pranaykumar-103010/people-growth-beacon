import "@tanstack/start-client-core";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute("/api/chat") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = await request.json() as { messages?: UIMessage[] };
        const messages = Array.isArray(body.messages) ? body.messages : null;
        if (!messages) return new Response("Messages required", { status: 400 });

        const auth = request.headers.get("authorization") || "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const SUPA = process.env.SUPABASE_URL!;
        const KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient(SUPA, KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: emps } = await supabase.from("employees")
          .select("emp_id,name,job_title,level,department,sub_vertical,annual_rating,potential_rating,attrition_risk,retention_risk_band,talent_segment,leadership_readiness,ai_readiness_band,flight_risk_drivers,manager_email,hrbp_insights")
          .eq("active", true).limit(200);

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("AI not configured", { status: 500 });

        const compact = (emps ?? []).map((e) => ({
          id: e.emp_id, name: e.name, role: e.job_title, level: e.level,
          dept: e.department, sv: e.sub_vertical, perf: e.annual_rating, pot: e.potential_rating,
          risk: e.attrition_risk, band: e.retention_risk_band, seg: e.talent_segment,
          leader: e.leadership_readiness, ai: e.ai_readiness_band,
          drivers: e.flight_risk_drivers, mgr: e.manager_email,
          note: (e.hrbp_insights ?? "").slice(0, 200),
        }));

        const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
        const gateway = createLovableAiGatewayProvider(apiKey);

        const system = `You are an HRBP Copilot for FieldAssist. Answer using ONLY the employee dataset below — these are the rows the current user is allowed to see (RLS-scoped). Be concise, structured, and actionable. Use markdown lists and tables. If a question asks for people, name 3-8 maximum. Recommend specific 30-60 day actions when relevant. If the data doesn't support an answer, say so.

DATASET (${compact.length} visible employees):
${JSON.stringify(compact)}`;

        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
