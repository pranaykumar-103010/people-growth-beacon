import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useEmployees } from "@/hooks/use-employees";
import { useAuth } from "@/hooks/use-auth";
import { tenureBand, type Employee, type TenureBand } from "@/lib/types";

export type ScopeMode = "cxo" | "rollup" | "line" | "hrbp";

export const SCOPE_LABEL: Record<ScopeMode, string> = {
  cxo: "CXO View",
  rollup: "Roll-up Manager View",
  line: "Line Manager View",
  hrbp: "HRBP View",
};

export type Filters = {
  departments: string[];
  subVerticals: string[];
  locations: string[];
  levels: string[];
  managers: string[];
  tenures: TenureBand[];
};

const EMPTY: Filters = { departments: [], subVerticals: [], locations: [], levels: [], managers: [], tenures: [] };

type Ctx = {
  scope: ScopeMode;
  setScope: (s: ScopeMode) => void;
  filters: Filters;
  setFilter: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
  clearFilters: () => void;
  /** RLS-visible rows narrowed by the scope switcher only. */
  scoped: Employee[];
  /** Scoped rows narrowed by the global filter panel. */
  employees: Employee[];
  allVisible: Employee[];
  isLoading: boolean;
};

const ScopeCtx = createContext<Ctx | null>(null);

function lower(v: string | null | undefined) {
  return (v ?? "").toLowerCase();
}

/** Everyone reporting into `me`, directly or through the chain. */
function reportingTree(rows: Employee[], me: string): Employee[] {
  const byMgr = new Map<string, Employee[]>();
  for (const e of rows) {
    const k = lower(e.manager_email);
    byMgr.set(k, [...(byMgr.get(k) ?? []), e]);
  }
  const out: Employee[] = [];
  const seen = new Set<string>();
  const walk = (mgr: string) => {
    if (!mgr || seen.has(mgr)) return;
    seen.add(mgr);
    for (const d of byMgr.get(mgr) ?? []) {
      if (out.some((o) => o.emp_id === d.emp_id)) continue;
      out.push(d);
      walk(lower(d.email));
    }
  };
  walk(me);
  return out;
}

export function ScopeProvider({ children }: { children: ReactNode }) {
  const { email, role, isAdmin } = useAuth();
  const { data: allVisible = [], isLoading } = useEmployees();
  const defaultScope: ScopeMode = isAdmin ? "cxo" : role === "manager" ? "line" : role === "rollup_manager" ? "rollup" : "hrbp";
  const [scope, setScope] = useState<ScopeMode | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const active = scope ?? defaultScope;

  const scoped = useMemo(() => {
    const me = lower(email);
    if (!me) return allVisible;
    if (active === "line") return allVisible.filter((e) => lower(e.manager_email) === me);
    if (active === "rollup") {
      const tree = reportingTree(allVisible, me);
      const ids = new Set(tree.map((t) => t.emp_id));
      return allVisible.filter((e) => ids.has(e.emp_id) || lower(e.rollup_manager_email) === me);
    }
    return allVisible; // cxo + hrbp = everything RLS already allows
  }, [allVisible, active, email]);

  const employees = useMemo(() => {
    const f = filters;
    return scoped.filter((e) =>
      (f.departments.length === 0 || f.departments.includes(e.department)) &&
      (f.subVerticals.length === 0 || f.subVerticals.includes(e.sub_vertical ?? "Unmapped")) &&
      (f.locations.length === 0 || f.locations.includes(e.location ?? "Unmapped")) &&
      (f.levels.length === 0 || f.levels.includes((e.level ?? "Unmapped").toUpperCase())) &&
      (f.managers.length === 0 || f.managers.includes(lower(e.manager_email)) || f.managers.includes(lower(e.rollup_manager_email))) &&
      (f.tenures.length === 0 || f.tenures.includes(tenureBand(e.joining_date))));
  }, [scoped, filters]);

  const value: Ctx = {
    scope: active,
    setScope,
    filters,
    setFilter: (k, v) => setFilters((p) => ({ ...p, [k]: v })),
    clearFilters: () => setFilters(EMPTY),
    scoped,
    employees,
    allVisible,
    isLoading,
  };
  return <ScopeCtx.Provider value={value}>{children}</ScopeCtx.Provider>;
}

export function useScope(): Ctx {
  const ctx = useContext(ScopeCtx);
  if (!ctx) throw new Error("useScope must be used inside ScopeProvider");
  return ctx;
}

export function nameFromEmail(email: string | null | undefined) {
  if (!email) return "—";
  return email.split("@")[0].split(/[._-]/).filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
}
