import { useMemo } from "react";
import { Check, ChevronDown, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useScope, SCOPE_LABEL, type Filters, type ScopeMode } from "@/lib/scope";
import { TENURE_BANDS, tenureBand } from "@/lib/types";
import { nameFromEmail } from "@/lib/scope";
import { useAuth } from "@/hooks/use-auth";

const SCOPES: ScopeMode[] = ["cxo", "hrbp", "rollup", "line"];

function MultiSelect({ label, options, selected, onChange, render }: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  render?: (v: string) => string;
}) {
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
          {label}
          {selected.length > 0 && (
            <span className="rounded-full bg-accent/15 text-accent px-1.5 text-[10px]">{selected.length}</span>
          )}
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-1 max-h-72 overflow-y-auto">
        {options.length === 0 && <div className="px-2 py-3 text-xs text-muted-foreground">No options in scope.</div>}
        {options.map((o) => (
          <button
            key={o}
            onClick={() => toggle(o)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm hover:bg-secondary transition"
          >
            <span className={`size-4 rounded border grid place-items-center flex-shrink-0 ${selected.includes(o) ? "bg-accent border-accent text-accent-foreground" : "border-border"}`}>
              {selected.includes(o) && <Check className="size-3" />}
            </span>
            <span className="truncate">{render ? render(o) : o}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function GlobalFilterBar() {
  const { scope, setScope, filters, setFilter, clearFilters, scoped, employees } = useScope();
  const { role, isAdmin } = useAuth();

  const opts = useMemo(() => {
    const uniq = (arr: (string | null | undefined)[]) =>
      Array.from(new Set(arr.map((v) => (v ?? "").trim()).filter(Boolean))).sort();
    return {
      departments: uniq(scoped.map((e) => e.department)),
      subVerticals: uniq(scoped.map((e) => e.sub_vertical ?? "Unmapped")),
      locations: uniq(scoped.map((e) => e.location ?? "Unmapped")),
      levels: uniq(scoped.map((e) => (e.level ?? "Unmapped").toUpperCase())),
      managers: uniq([...scoped.map((e) => e.manager_email?.toLowerCase()), ...scoped.map((e) => e.rollup_manager_email?.toLowerCase())]),
      tenures: TENURE_BANDS.filter((b) => scoped.some((e) => tenureBand(e.joining_date) === b)),
    };
  }, [scoped]);

  const availableScopes = isAdmin ? SCOPES : role === "function_head" ? (["hrbp", "rollup", "line"] as ScopeMode[]) : role === "rollup_manager" ? (["rollup", "line"] as ScopeMode[]) : (["line"] as ScopeMode[]);
  const activeCount = (Object.keys(filters) as (keyof Filters)[]).reduce((n, k) => n + filters[k].length, 0);

  return (
    <div className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
      <div className="px-5 md:px-8 py-2.5 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg bg-secondary/70 p-0.5">
          {availableScopes.map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${scope === s ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {SCOPE_LABEL[s].replace(" View", "")}
            </button>
          ))}
        </div>

        <span className="h-5 w-px bg-border mx-1 hidden md:block" />
        <Filter className="size-3.5 text-muted-foreground hidden md:block" />

        <MultiSelect label="Department" options={opts.departments} selected={filters.departments} onChange={(v) => setFilter("departments", v)} />
        <MultiSelect label="Sub-Dept" options={opts.subVerticals} selected={filters.subVerticals} onChange={(v) => setFilter("subVerticals", v)} />
        <MultiSelect label="Location" options={opts.locations} selected={filters.locations} onChange={(v) => setFilter("locations", v)} />
        <MultiSelect label="Level" options={opts.levels} selected={filters.levels} onChange={(v) => setFilter("levels", v)} />
        <MultiSelect label="Manager" options={opts.managers} selected={filters.managers} onChange={(v) => setFilter("managers", v)} render={nameFromEmail} />
        <MultiSelect label="Tenure" options={opts.tenures} selected={filters.tenures} onChange={(v) => setFilter("tenures", v as Filters["tenures"])} />

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={clearFilters}>
            <X className="size-3" /> Clear
          </Button>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
          {employees.length} of {scoped.length} in view
        </span>
      </div>
    </div>
  );
}
