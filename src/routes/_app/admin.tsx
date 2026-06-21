import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Search, Loader2, FileSpreadsheet, ShieldCheck, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useEmployees } from "@/hooks/use-employees";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHead, TableHeader, TableRow, TableBody, TableCell } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { upsertEmployees, updateEmployeeField } from "@/lib/employees.functions";
import { slugifyEmail } from "@/lib/types";
import type { Employee } from "@/lib/types";

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
});

type TabKey = "core" | "ratings" | "insights";

const TAB_CONFIG: Record<TabKey, { title: string; desc: string; columns: string[] }> = {
  core: {
    title: "Core Master Data",
    desc: "Employee ID · Name · Department · Sub-Vertical · Manager · Roll-up · Function Head · Active",
    columns: ["Employee ID","Name","Email","Department","Sub-Vertical","Manager","Roll-up Manager","Function Head","Attrition Risk","Active"],
  },
  ratings: {
    title: "Performance & Potential",
    desc: "Employee ID · H2 Rating (1-5) · Potential Rating (1-5) · Succession Notes · Future Career Path",
    columns: ["Employee ID","H2 Rating","Potential Rating","Succession Notes","Future Career Path"],
  },
  insights: {
    title: "HRBP Qualitative Insights",
    desc: "Employee ID · HRBP Insights · RAG Status (green/amber/red)",
    columns: ["Employee ID","HRBP Insights","RAG Status"],
  },
};

function normalizeEmailMaybe(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.includes("@")) return s.toLowerCase();
  return slugifyEmail(s);
}

function rowsFromSheet(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => {
      try {
        const data = new Uint8Array(fr.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
        resolve(json);
      } catch (e) { reject(e); }
    };
    fr.readAsArrayBuffer(file);
  });
}

function mapRow(tab: TabKey, raw: Record<string, unknown>): Record<string, unknown> {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      for (const rk of Object.keys(raw)) {
        if (rk.trim().toLowerCase() === k.toLowerCase()) return raw[rk];
      }
    }
    return undefined;
  };
  const emp_id = String(get("Employee ID","Employee Number","emp_id","ID") ?? "").trim();
  const base: Record<string, unknown> = { emp_id };
  if (tab === "core") {
    const mgr = get("Manager","Reporting Manager","manager_email");
    const rmgr = get("Roll-up Manager","Rollup Manager","rollup_manager_email");
    const fh = get("Function Head","Functional Head","function_head_email");
    return {
      ...base,
      name: get("Name","Employee Name") ?? undefined,
      email: normalizeEmailMaybe(get("Email")) ?? slugifyEmail(String(get("Name","Employee Name") ?? emp_id)),
      department: get("Department") ?? undefined,
      sub_vertical: get("Sub-Vertical","Sub Vertical","Sub -Vertical") ?? undefined,
      manager_email: normalizeEmailMaybe(mgr) ?? undefined,
      rollup_manager_email: normalizeEmailMaybe(rmgr),
      function_head_email: normalizeEmailMaybe(fh),
      attrition_risk: get("Attrition Risk","Risk","Overall Numbers") != null ? Number(get("Attrition Risk","Risk","Overall Numbers")) : undefined,
      active: get("Active","Active Status") != null ? /^(yes|true|1|active)$/i.test(String(get("Active","Active Status"))) : undefined,
    };
  }
  if (tab === "ratings") {
    return {
      ...base,
      h2_rating: get("H2 Rating","Performance Rating","Performance","performance_rating") != null ? Number(get("H2 Rating","Performance Rating","Performance","performance_rating")) : undefined,
      potential_rating: get("Potential Rating","Potential","potential_rating") != null ? Number(get("Potential Rating","Potential","potential_rating")) : undefined,
      succession_notes: get("Succession Notes","Succession Planning Notes","Succession Planning Next Steps") ?? undefined,
      future_career_path: get("Future Career Path","Career Path") ?? undefined,
    };
  }
  return {
    ...base,
    hrbp_insights: get("HRBP Insights","Qualitative HRBP Insights","Insights") ?? undefined,
    rag_status: ((): string | undefined => {
      const r = get("RAG Status","RAG");
      if (!r) return undefined;
      const s = String(r).trim().toLowerCase();
      return ["green","amber","red"].includes(s) ? s : undefined;
    })(),
  };
}

function UploadTab({ tab }: { tab: TabKey }) {
  const cfg = TAB_CONFIG[tab];
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upsert = useServerFn(upsertEmployees);
  const qc = useQueryClient();

  const handle = async (file: File) => {
    setBusy(true);
    try {
      const raw = await rowsFromSheet(file);
      const mapped = raw.map((r) => mapRow(tab, r)).filter((r) => r.emp_id);
      if (!mapped.length) { toast.error("No rows with Employee ID found."); return; }
      // Clean undefineds so the upsert merges rather than nulls them
      const rows = mapped.map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined))) as never;
      const res = await upsert({ data: { rows } });
      toast.success(`Upserted ${res.count} employees.`);
      qc.invalidateQueries({ queryKey: ["employees"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div>
          <div className="font-display text-lg">{cfg.title}</div>
          <p className="text-sm text-muted-foreground mt-1">{cfg.desc}</p>
        </div>

        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-8 hover:bg-secondary/40 transition cursor-pointer">
          {busy ? <Loader2 className="size-6 animate-spin text-accent" /> : <Upload className="size-6 text-accent" />}
          <div className="font-medium text-sm">{busy ? "Processing…" : "Drop or click to upload .xlsx / .csv"}</div>
          <div className="text-xs text-muted-foreground">Rows are merged by Employee ID. Other fields are preserved.</div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }}
            disabled={busy}
          />
        </label>

        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <FileSpreadsheet className="size-3.5" /> Expected columns
          </div>
          <div className="flex flex-wrap gap-1.5">
            {cfg.columns.map((c) => (
              <span key={c} className="text-[11px] px-2 py-0.5 rounded bg-secondary text-muted-foreground">{c}</span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InlineEditGrid() {
  const { data: employees = [], isLoading } = useEmployees();
  const [q, setQ] = useState("");
  const updateField = useServerFn(updateEmployeeField);
  const qc = useQueryClient();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((e) =>
      [e.name, e.emp_id, e.email, e.sub_vertical, e.manager_email, e.nine_box_quadrant]
        .filter(Boolean).some((x) => String(x).toLowerCase().includes(term))
    );
  }, [employees, q]);

  const save = async (emp_id: string, field: keyof Employee, value: unknown) => {
    try {
      await updateField({ data: { emp_id, patch: { [field]: value } } });
      qc.invalidateQueries({ queryKey: ["employees"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-display text-lg flex-1">Inline editor · {employees.length} employees</div>
          <div className="relative">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, manager…" className="pl-8 w-64" />
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Sub-Vertical</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="w-16">H2</TableHead>
                <TableHead className="w-16">Pot.</TableHead>
                <TableHead className="w-20">Risk</TableHead>
                <TableHead>9-Box</TableHead>
                <TableHead>HRBP Insights</TableHead>
                <TableHead>Succession</TableHead>
                <TableHead>Career</TableHead>
                <TableHead className="w-16">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-6">No matches.</TableCell></TableRow>
              )}
              {filtered.map((e) => (
                <TableRow key={e.emp_id}>
                  <TableCell className="font-mono text-xs">{e.emp_id}</TableCell>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell><EditableCell value={e.sub_vertical ?? ""} onSave={(v) => save(e.emp_id, "sub_vertical", v)} /></TableCell>
                  <TableCell><EditableCell value={e.manager_email} onSave={(v) => save(e.emp_id, "manager_email", v)} /></TableCell>
                  <TableCell><EditableCell type="number" value={String(e.h2_rating)} onSave={(v) => save(e.emp_id, "h2_rating", Number(v))} /></TableCell>
                  <TableCell><EditableCell type="number" value={String(e.potential_rating)} onSave={(v) => save(e.emp_id, "potential_rating", Number(v))} /></TableCell>
                  <TableCell><EditableCell type="number" value={String(e.attrition_risk)} onSave={(v) => save(e.emp_id, "attrition_risk", Number(v))} /></TableCell>
                  <TableCell className="text-xs">{e.nine_box_quadrant}</TableCell>
                  <TableCell className="min-w-48"><EditableCell value={e.hrbp_insights ?? ""} onSave={(v) => save(e.emp_id, "hrbp_insights", v)} /></TableCell>
                  <TableCell className="min-w-48"><EditableCell value={e.succession_notes ?? ""} onSave={(v) => save(e.emp_id, "succession_notes", v)} /></TableCell>
                  <TableCell className="min-w-48"><EditableCell value={e.future_career_path ?? ""} onSave={(v) => save(e.emp_id, "future_career_path", v)} /></TableCell>
                  <TableCell>
                    <input
                      type="checkbox" checked={e.active}
                      onChange={(ev) => save(e.emp_id, "active", ev.target.checked)}
                      className="size-4 accent-primary"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function EditableCell({ value, onSave, type = "text" }: { value: string; onSave: (v: string) => void; type?: "text" | "number" }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <Input
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onSave(draft); }}
      className="h-8 text-xs"
    />
  );
}

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !isAdmin) navigate({ to: "/" }); }, [isAdmin, loading, navigate]);

  if (loading || !isAdmin) return null;
  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-accent font-medium flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> HRBP Admin</div>
        <h1 className="font-display text-3xl md:text-4xl">Data ingestion & inline edits</h1>
        <p className="text-muted-foreground text-sm mt-1">Upload by Employee ID to upsert without losing other fields. Edit any cell below to save instantly.</p>
      </header>

      <Tabs defaultValue="core">
        <TabsList>
          <TabsTrigger value="core">Core Master</TabsTrigger>
          <TabsTrigger value="ratings">Performance & Potential</TabsTrigger>
          <TabsTrigger value="insights">HRBP Insights</TabsTrigger>
        </TabsList>
        <TabsContent value="core" className="mt-4"><UploadTab tab="core" /></TabsContent>
        <TabsContent value="ratings" className="mt-4"><UploadTab tab="ratings" /></TabsContent>
        <TabsContent value="insights" className="mt-4"><UploadTab tab="insights" /></TabsContent>
      </Tabs>

      <InlineEditGrid />
    </div>
  );
}
