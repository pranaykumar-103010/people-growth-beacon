# Talent IQ → AI HRBP Command Center Upgrade

**Guiding rule:** every existing route, RLS rule, design token, and working feature stays intact. All changes are additive — new columns, new pages, new components, enriched existing pages.

The uploaded Excel matches the 32 rows already seeded, but adds an `HRBP Insights` qualitative column we'll merge in. No schema breaks; new derived fields (talent segment, risk band, flight-risk drivers, AI readiness, leadership readiness, dept summary cache) are added as nullable columns.

---

## Step 1 — Data refresh (migration + data import)
- Add nullable columns to `employees`: `talent_segment`, `retention_risk_band` (low/medium/high/critical), `flight_risk_drivers text[]`, `ai_readiness_band`, `ai_readiness_score int`, `leadership_readiness` (ready_now / 1y / 2y / ic_track), `ai_recommended_actions text[]`, `ai_insight_generated_at timestamptz`.
- Add table `department_insights` (department, strengths[], risks[], actions[], updated_at) — HRBP-readable.
- Upsert `hrbp_insights` text from Excel for the 32 rows (idempotent).
- Deterministic compute (SQL or one-shot server fn) for `talent_segment`, `retention_risk_band`, `flight_risk_drivers`, `ai_readiness_*`, `leadership_readiness` from existing fields (perf, potential, risk, tenure, level, sub-vertical).

## Step 2 — AI Insight Engine (server functions)
- `generateEmployeeInsight(emp_id)` → uses Lovable AI (`google/gemini-3-flash-preview`) with structured output (`Output.object`) → writes `hrbp_insights`, `ai_recommended_actions`, `flight_risk_drivers`, refreshes `retention_risk_band`.
- `generateDepartmentInsight(department)` → upserts `department_insights`.
- `bulkGenerateInsights()` (HRBP-admin only) — iterates employees missing insight; surfaced as a button on the Admin page.
- All gated by `requireSupabaseAuth` + role checks; per-call only the caller's RLS-visible rows.

## Step 3 — Command Center beautification (existing route `/`)
Add **above** existing KPIs, do not remove anything:
- Executive Summary strip: Total visible · High-risk · Critical talent · Succession-ready · AI-readiness % · Avg perf · Avg risk · Top retention concern (single line, top driver).
- Quick filters row: search box, department, sub-vertical, manager, risk band, segment — drives the existing "Attention Required" list and a new compact employee table below it.
- Row click still opens the existing employee drawer (now also shows AI insight + recommended actions + flight-risk driver chips + "Regenerate with AI" button).

## Step 4 — Two new routes (additive, in nav)
- `/talent-segments` — Performance × Risk 9-grid (Future Leaders, Retention Priority, Flight-Risk Stars, Critical Intervention, …) using existing `Card`/`Sheet` patterns from talent-matrix.
- `/leadership-pipeline` — buckets Ready Now / 1y / 2y / IC; click bucket → drawer with rationale.
- `/ai-readiness` — small page: org % by band + department bar chart (Recharts, same theme as Attrition Radar).

(I'll consolidate readiness into the Leadership page if you'd prefer fewer routes — say the word.)

## Step 5 — Department Insights
- New panel on existing Attrition Radar: per-department card (strengths / risks / 3 actions), generated on demand by HRBP via "Generate dept insight" button.

## Step 6 — AI Copilot (right-side slide-over)
- Floating button in `AppShell` (HRBP-visible). Opens a `Sheet` chat using AI SDK `useChat` against a new `/api/chat` route.
- The route fetches the caller's RLS-visible employees server-side and passes a compact JSON snapshot into the system prompt — so answers stay scoped to what the user can see. Suggested-question chips match the brief.

## Step 7 — Export & polish
- Existing "Export Team Data" stays; extend the XLSX columns to include the new fields (segment, risk band, drivers, AI readiness, leadership readiness, AI insight).
- PDF export of the Executive Summary card strip (browser print stylesheet — no new heavy dep).

## What is explicitly **not** touched
- Auth flow, RLS policies (only new columns get the same SELECT policy), routing for `/`, `/talent-matrix`, `/attrition`, `/risk-methodology`, `/admin`, `/login`.
- Color tokens, fonts, sidebar layout, existing drawer interactions.
- The Manager / Rollup / Function Head / HRBP role model.

## Technical notes (non-user-facing)
- Migration runs as one statement; all new columns nullable so existing RLS policy auto-covers them.
- AI calls server-side only; `LOVABLE_API_KEY` already present.
- Department cache table avoids re-paying for LLM calls every page load.
- Copilot uses `streamText().toUIMessageStreamResponse()` per `tanstack-ai-chat` and AI Elements for the UI surface.

---

## Suggested execution order
Step 1 (migration + data) → Step 2 (AI fns) → Step 3 (Command Center) → Step 4 (new routes) → Step 5 (dept insights) → Step 6 (Copilot) → Step 7 (exports/polish).

**Reply `go` to start at Step 1**, or tell me which steps to drop / reorder. Given the size I'll pause after each step for you to sanity-check, same cadence as last time.
