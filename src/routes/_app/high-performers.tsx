import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Download, Trophy } from "lucide-react";
import { useScope } from "@/lib/scope";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RagBadge } from "@/components/Rag";
import { exportEmployeesXlsx } from "@/lib/export";

export const Route = createFileRoute("/_app/high-performers")({ component: HighPerformers });

const THRESHOLD = 3.75;

function HighPerformers() {
  const { role } = useAuth();
  const { employees } = useScope();

  const list = useMemo(
    () => employees.filter((e) => Number(e.annual_rating) >= THRESHOLD).sort((a, b) => b.annual_rating - a.annual_rating),
    [employees],
  );

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-accent font-medium">Talent Excellence</div>
          <h1 className="font-display text-3xl md:text-4xl flex items-center gap-2">
            <Trophy className="size-7 text-rag-green" /> High Performers
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {list.length} of {employees.length} in scope · sorted by annual rating.
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={list.length === 0}
          onClick={() => exportEmployeesXlsx(list, `high-performers-${role ?? "team"}`)}>
          <Download className="size-4" /> Export
        </Button>
      </header>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5 hidden md:table-cell">Role / Sub-vertical</th>
                <th className="text-left px-4 py-2.5 hidden lg:table-cell">Manager</th>
                <th className="text-center px-4 py-2.5">Annual</th>
                <th className="text-center px-4 py-2.5">Potential</th>
                <th className="text-center px-4 py-2.5">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((e) => (
                <tr key={e.emp_id} className="hover:bg-secondary/40">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{e.name}</div>
                    <div className="text-xs text-muted-foreground">{e.talent_segment ?? "—"}</div>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground">{e.job_title} · {e.sub_vertical}</td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-muted-foreground text-xs">{e.manager_email}</td>
                  <td className="px-4 py-2.5 text-center font-medium text-rag-green">{e.annual_rating}</td>
                  <td className="px-4 py-2.5 text-center">{e.potential_rating}</td>
                  <td className="px-4 py-2.5 text-center"><RagBadge score={e.attrition_risk} /></td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No employees in scope meet the {THRESHOLD}+ threshold.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
