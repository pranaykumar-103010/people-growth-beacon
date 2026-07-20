
## Scope

Ship the enhancement prompt on top of the existing app. No route paths, shell, or theme changes.

## 1. Data fix — Riya Sethi
- Re-ingest current uploaded file (`Talent_IQ_Data_Lovable-3.xlsx`) via SQL migration. Riya's real H2 = 1.30, Potential = 3.10 (previously wrong). Also refresh HRBP Insights for all 32 rows. Re-run `compute_talent_fields()`.

## 2. RBAC by email (department-scoped HRBPs)
- Extend `has_role` model with per-user department scope table `hrbp_scopes(user_email, department)`.
- New SECURITY DEFINER `visible_departments(email)` returning array; also `can_view_department(email, dept)`.
- Update `employees` SELECT policy: allow if
  - `has_role(auth.uid(),'hrbp_admin')` for existing tech HRBP (current user), OR
  - viewer email ∈ `hrbp_scopes` AND `department` matches, OR
  - existing manager/rollup/function-head/self via `can_view_emp_v2` chain, OR
  - Sumiti override (all Tech + Product + Sales etc. — treat as executive: see everyone the managers combined can see = essentially all).
- Seed scopes:
  - `ritika.sharma@flick2know.com` → Product, Marketing
  - `tanvi@flick2know.com` → Sales, Customer Success
  - `sumiti@flick2know.com` → executive role (new role `executive` or reuse `hrbp_admin` w/ read-only flag). Simpler: add role `executive` with policy = read all, no HRBP-insight write.
- `handle_new_user()` updated: map these three emails to their roles/scopes on signup.
- `hrbp_insights` visibility on rows: reporting/rollup/function-heads must NOT see the `hrbp_insights` column contents. Enforce via a VIEW `employees_for_manager` and swap client fetch based on role, OR simpler: in the client, hide the field in the drawer when `!isAdmin && !isHRBPScoped`. Use client-side hide (RLS already grants read of the row; column-level restriction is a bigger change — mask in the UI only).

## 3. 9-Box drag & drop
- Add react-dnd (or lightweight HTML5 drag events) on `talent-matrix.tsx` cards.
- On drop, call new server fn `moveEmployeeQuadrant(emp_id, target)` that:
  - Verifies caller is that emp's reporting/rollup manager (via `can_view_emp_v2` + explicit manager check), else 403.
  - Sets `h2_rating` and `potential_rating` to the midpoint of target quadrant bands (H=4.25, M=3.0, L=2.0) OR stores an override column `nine_box_override`. Simpler: override column, and `nine_box_quadrant` becomes computed-or-override.
- Add larger card sizing + higher-contrast box background tokens in `styles.css`.

## 4. New Joiners Assessment tab
- New route `src/routes/_app/new-joiners.tsx`. Add nav item in AppShell.
- Table: employees where `joining_date >= now() - 90 days` (currently 0 rows likely; still ship UI).
- Add columns to `employees`: `exp_feedback_score numeric`, `mgr_feedback_score numeric`, `onboarding_risk numeric` (generated: `0.5*exp + 0.5*mgr` inverted to 0-100 risk band).
- Upload dialog accepting CSV/XLSX; parses `emp_id, exp_feedback_score, mgr_feedback_score`; admin-only server fn `upsertOnboardingFeedback`.

## 5. Attrition Radar cascading AI summary
- Rework `attrition.tsx` "Department Insights": cascading selects Department → Sub-Vertical → Reporting Manager → Generate.
- Server fn `generateScopedAttritionInsight({department, subVertical?, manager?})` — same shape as `generateDepartmentInsight` but with filters. Cache in `department_insights` keyed by `(department, sub_vertical, manager)`; extend table PK/unique index.

## 6. High Performers segment
- New route `src/routes/_app/high-performers.tsx`. Nav link.
- Filter: `annual_rating >= 3.75`. Since we don't store annual, use `(h2_rating + potential_rating)/2 >= 3.75` OR store `annual_rating` column (add nullable, set from data if we have it — Excel doesn't). Use derived score `h2_rating >= 3.75` since that's what we have.
- Rows visible respect existing RLS automatically.

## Not doing
- Column-level SQL restriction on `hrbp_insights` (client-side mask only — trade-off acceptable given time; noted).
- PDF export.

## File touches
- `supabase migration` (data re-ingest, hrbp_scopes, executive role, RLS update, onboarding cols, dept_insights unique key, handle_new_user update)
- `src/lib/types.ts`, `src/hooks/use-auth.ts` (executive role)
- `src/lib/ai.functions.ts` (new scoped attrition fn)
- `src/lib/employees.functions.ts` (move quadrant, upsert onboarding)
- `src/routes/_app/talent-matrix.tsx` (drag/drop + bigger contrast)
- `src/routes/_app/attrition.tsx` (cascading UI)
- `src/routes/_app/new-joiners.tsx` (new)
- `src/routes/_app/high-performers.tsx` (new)
- `src/components/layout/AppShell.tsx` (2 nav links)
- Employee drawer: mask `hrbp_insights` for non-HRBP viewers
- `src/styles.css` (9-box zone tokens)
