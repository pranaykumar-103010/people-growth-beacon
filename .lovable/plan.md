# Talent IQ — v2 Rebuild Plan

Rebuilds the pilot on top of Lovable Cloud (Supabase): real auth, real DB, RLS, and the 32-row Excel dataset as the live seed. Keeps the existing visual design, routes, and 9-Box / Attrition / Risk Methodology pages intact.

---

## 1. Auth (Google-only + domain wall)

- Enable Google OAuth via Lovable managed broker; disable email/password.
- After sign-in, a client gate checks the email domain. If not `@flick2know.com` or `@fieldassist.in` → `supabase.auth.signOut()` + show **"Access Restricted. Please log in using your official FieldAssist or Flick2Know email address."** on `/login`.
- `pranay.kumar@flick2know.com` seeded as `hrbp_admin` via a migration trigger that auto-grants this email on first sign-in.

## 2. Schema (migration)

```text
employees           — emp_id (PK text, e.g. F2K0060), name, job_title, level,
                      department, sub_vertical, joining_date,
                      manager_email, rollup_manager_email, function_head_email,
                      active (bool), attrition_risk (int 0-100), rag_status,
                      h2_rating numeric(2,1), potential_rating numeric(2,1),
                      nine_box_quadrant (generated), succession_notes,
                      future_career_path, hrbp_insights
employee_directory  — email (PK), display_name  (name→email mapping)
user_roles          — (user_id, role)  roles: hrbp_admin | function_head |
                      rollup_manager | manager
hrbp_notes          — keep existing
```

- Auto-generated emails: `slug(name) + '@flick2know.com'` (e.g. Anuj Gupta → `anuj.gupta@flick2know.com`). Stored in `employee_directory` and used in all three manager columns of `employees`.

## 3. RLS — 4-tier visibility

Security-definer function `can_view_employee(viewer_email, emp_row)` returns true if any of:

- viewer is `hrbp_admin`
- `emp.manager_email = viewer_email`
- `emp.rollup_manager_email = viewer_email`
- `emp.function_head_email = viewer_email`
- `emp.email = viewer_email` (self)

Single SELECT policy on `employees` calls it. Same gate reused for `hrbp_notes` via employee FK.

A user's role is derived on first login from where their email appears in the directory (function head > rollup > manager > self) and stored in `user_roles`. HRBP role is manual.

## 4. Data ingest — real Excel now

Migration seeds all 32 employees from `Talent_IQ_Data_Lovable.xlsx`:

- Build manager email map from the 3 manager-name columns + employee names.
- Insert directory rows, then employees with H2/Potential ratings from the sheet.
- **Hybrid fill** for missing fields: deterministic `attrition_risk` (0–100) and `rag_status` computed from `(5 - h2_rating)` weighted with tenure; `succession_notes`, `future_career_path`, `hrbp_insights` left blank for HRBPs.
- `nine_box_quadrant` computed by a Postgres function using the exact rubric you specified (Star / Key Player / Question Mark / High Performer / Core Player / Inconsistent / Solid Performer / Risk / Iceberg).

## 5. Admin page (`/admin`, HRBP-only)

Three tabs, each with a drag-drop `.xlsx`/`.csv` uploader (parsed client-side with SheetJS, upserted by `emp_id` via server functions):

1. **Core Master** — IDs, names, department, sub-vertical, manager emails, active, attrition risk.
2. **Performance & Potential** — H2 + potential ratings, succession notes, future career path.
3. **HRBP Insights** — qualitative narrative, RAG.

Plus an **inline-edit datagrid** below the tabs: search, click-to-edit any field, save updates the row server-side (RLS bypass via admin server fn that re-checks role).

Upserts merge by `emp_id` — unrelated columns are preserved.

## 6. 9-Box refinements

- Grid sized to viewport (`h-[calc(100vh-220px)]`, `overflow:hidden` on the page, `overflow-y:auto` inside each cell) — no page scroll.
- Each cell shows up to N employee chips with **Name · Sub-Vertical · Manager** and a "+X more" affordance.
- Click a cell → side sheet listing everyone in that quadrant.
- Click a chip → employee detail modal: H2, Potential, computed quadrant, Succession Next Steps, Future Career Path, HRBP Insights, attrition risk.
- Quadrant mapping uses the exact rubric from your brief.

## 7. Exports

`Export Team Data` button on Dashboard + Attrition Radar for every non-admin role (Manager / Rollup / Function Head). Uses `xlsx` to generate a `.xlsx` with the rows already filtered by RLS (we just select all visible employees and write the file in-browser). Columns: Name, Sub-Vertical, Manager, H2, Potential, 9-Box, Attrition Risk, RAG, HRBP Insights.

## 8. Mock cleanup

Delete `src/lib/mock-store.ts`, `src/lib/mock-ai.ts`, mock branches in `use-auth`, `use-employees`, `StayConversationButton`. Restore real Supabase reads via TanStack Query + `createServerFn` (auth-protected). Risk Methodology page stays as-is (pure UI).

---

## Technical notes

- Server fns live in `src/lib/*.functions.ts`; admin upserts use `requireSupabaseAuth` + role check (no service-role exposure).
- `_authenticated/route.tsx` (integration-managed) guards `/`, `/attrition`, `/talent-matrix`, `/risk-methodology`, `/admin`. `/login` stays public.
- Domain gate runs in `__root.tsx` `onAuthStateChange` so the sign-out fires even if Google issues a session for a non-corporate email.
- `xlsx` (SheetJS) added as a dep for both ingest (admin uploads) and exports.
- Migration includes `GRANT` on every new public table, plus an `INSERT` block for the 32 seed rows + directory.
- Hierarchy email mapping is generated once at migration time; HRBPs can correct any wrong auto-email through the inline grid.

## Out of scope (call out)

- No email verification flow (Google handles it).
- No audit log of HRBP edits in v2 — can be added later.
- "Active Status" defaults to `true` for all 32 rows; togglable in the admin grid.

Approve and I'll execute as a single sequence: migration → mock teardown → server fns + admin page → 9-Box rework → exports.
