# Talent IQ v2.1 — Hardening Plan

Builds on top of the existing v2 (Supabase + Google OAuth + 9-Box + Admin) without altering routes, layout, design tokens, or working features. Every risky swap is feature-flagged so dummy data never disappears unless real data is verified rendered.

---

## Step 0 — Excel inspection (already done)

Parsed `Talent_IQ_Data_Lovable.xlsx`: **32 rows, 12 columns**.

**Headers (verbatim) → app field mapping:**

| Excel header | Type | App field (`employees`) |
|---|---|---|
| `Employee Number` | string | `emp_id` (PK / upsert key) |
| `Employee Name` | string | `name` |
| `Reporting Manager` | string (name) | resolved → `manager_email` |
| `Roll-up Manager` | string (name) | resolved → `rollup_manager_email` |
| `Function Head` | string (name) | resolved → `function_head_email` |
| `Job Title` | string | `job_title` |
| `Level` | string | `level` |
| `Department` | string | `department` |
| `Sub -Vertical` *(note space)* | string | `sub_vertical` |
| `Joining Date` | date | `joining_date` |
| `H2 Rating` | number 0–5 | `h2_rating` (coerced to 1 decimal, clamped 1–5) |
| `Potential Rating` | number 0–5 | `potential_rating` (same) |

**Not present in the file** (will be derived or left null): `email`, `attrition_risk`, `rag_status`, `succession_notes`, `future_career_path`, `hrbp_insights`, `active`. Per prior approval: hybrid fill — risk/RAG computed from H2 + tenure; qualitative fields blank for HRBPs to fill.

**Email derivation rule** (auto-generate `@flick2know.com`):  
`slugify(name).replace(/\s+/g,'.') + '@flick2know.com'` — applied identically to employee + 3 manager-name columns so RLS joins line up.

---

## Step 1 — Schema delta migration

Existing tables (`employees`, `user_roles`, `profiles`, `hrbp_notes`, `employee_directory`) stay. Add:

1. `org_hierarchy` (materialized view of `employees` with `manager_email`, `rollup_manager_email`, `function_head_email`) — used by the recursive roll-up policy.
2. `audit_log` — `id, actor_email, emp_id, field, old_value, new_value, occurred_at`. RLS: insert by `authenticated`, select by `hrbp_admin` only.
3. Recursive SQL function `is_in_rollup_chain(viewer_email, emp_id)` for the Roll-up tier (walks `manager_email → manager's manager…`).
4. Extend `can_view_emp` to use the recursive function (Manager / Roll-up / Function Head / Self / Admin tiers).
5. Backfill `employees.email` column if missing (`ALTER TABLE … ADD COLUMN IF NOT EXISTS email text`).

All new tables get `GRANT` + `ENABLE RLS` + policies in the same migration.

## Step 2 — Real-data seed (idempotent, non-destructive)

A single migration `INSERT … ON CONFLICT (emp_id) DO UPDATE` for all 32 rows + `employee_directory` rows for every distinct name. No `DELETE` — existing rows are preserved.

Verification query bundled in the migration description: `SELECT count(*) FROM employees;` must return ≥ 32 before Step 4 swaps the UI.

## Step 3 — Dashboard reads from Supabase, dummy stays as fallback

- `useEmployees()` returns `{ data, source: 'live' | 'fallback' | 'error' }`.
- If Supabase query succeeds **and** `rowCount > 0` → `live`, dummy unused.
- If query errors or returns 0 rows → keep dummy array (kept in `src/lib/sample-employees.ts`, not deleted), `source = 'fallback'`, toast + banner shown.
- Re-fetch on `onAuthStateChange` and after any admin upload (TanStack Query invalidate).

## Step 4 — Admin page upgrades

Existing `/admin` page stays. Additions:

- **Three tabs** already exist; harden upserts to merge-only per Section 3d (never null out untouched fields — already implemented in `upsertEmployees`, verify and extend to Performance and HRBP tabs).
- **Confirmation modal** after every upload: `X inserted, Y updated, Z skipped` with downloadable error CSV for skipped rows.
- **Per-row validation** before insert: emp_id non-null & unique within batch; ratings integer-coerced & clamped 1–5; emails lowercased + domain-validated; invalid rows skipped + logged, not aborting batch.
- **Inline datagrid** already exists; add audit-log write on every `updateEmployeeField` call.

## Step 5 — 9-Box polish

Current `talent-matrix.tsx` already implements viewport-fit grid + chips + side sheet. Verify and tighten:

- `min-h-0` on grid children to enforce no outer scroll on small viewports.
- Each chip shows Name · Sub-Vertical · Manager (already present — confirm).
- Click chip → modal with H2, Potential, Succession Next Steps, Future Career Path, Attrition Risk (already wired — confirm fields populate from new columns).
- Quadrant mapping uses existing `compute_quadrant` SQL function which already matches the brief's rubric exactly.

## Step 6 — Export buttons

Existing `exportEmployeesXlsx` is reused. Add the **"Export Team Data"** button to Dashboard + Attrition Radar for any non-admin role (already partially present — verify visibility logic and that the export pulls from the RLS-filtered query, not a global list).

## Step 7 — Data-health guardrails

- `<DataHealthBadge />` in `AppShell` top nav: green "Live", amber "Fallback", red "Error" — driven by `useEmployees().source`.
- React error boundary around each route's main panel (`src/components/ErrorBoundary.tsx`) — never blank screen.
- `console.log` parsed Excel summary on admin upload (row count, headers, skipped rows with reasons).
- Smoke-test checklist run after each step and reported back.

---

## Execution order & pause points

I will pause for your **"continue"** between each step:

1. Schema delta migration (Step 1) — you approve the migration SQL.
2. Real-data seed migration (Step 2) — you approve the INSERT migration.
3. `useEmployees` fallback shape + `<DataHealthBadge />` (Steps 3 + 7a) — verify dashboard still shows data (live now; dummy if RLS hides).
4. Admin hardening: validation, confirmation modal, audit log (Step 4).
5. 9-Box + Export verification (Steps 5–6).
6. Error boundaries + final smoke test (Step 7b).

---

## Out of scope (call out)

- No deletion of `sample-employees.ts` fallback in this pass.
- No rewrite of the existing `__root.tsx` domain wall or `_authenticated` gate — both already work.
- No changes to design tokens, navigation, or route paths.
- Audit log is HRBP-readable only; no UI surfacing in this pass.

Approve and I'll execute Step 1.
