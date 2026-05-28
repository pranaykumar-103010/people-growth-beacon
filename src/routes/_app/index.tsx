import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Users, AlertTriangle, UserPlus, TrendingUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { useEmployees } from "@/hooks/use-employees";
import { useAuth } from "@/hooks/use-auth";
import { mockStore } from "@/lib/mock-store";
import { RagBadge } from "@/components/Rag";
import { StayConversationButton } from "@/components/StayConversationButton";
import { tenureDays } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/")({
  component: CommandCenter,
});

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string | number; sub?: string; tone?: "default" | "warning" | "good" }) {
  const ring = tone === "warning" ? "ring-rag-amber/30" : tone === "good" ? "ring-rag-green/30" : "ring-border";
  return (
    <Card className={`shadow-sm ring-1 ${ring} border-0`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-2 font-display text-3xl text-foreground">{value}</div>
            {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
          </div>
          <div className="size-10 rounded-lg bg-secondary grid place-items-center text-accent">
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AddEmployeeDialog({ defaultManager }: { defaultManager: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", job_title: "Software Engineer", sub_department: "Engineering",
    manager_email: defaultManager, performance_rating: 3, potential_rating: 3, risk_score: 25,
  });

  const submit = () => {
    if (!form.name.trim() || !form.manager_email.includes("@")) {
      toast.error("Name and manager email are required");
      return;
    }
    mockStore.addEmployee({
      name: form.name.trim(),
      email: form.email.trim() || null,
      job_title: form.job_title,
      sub_department: form.sub_department,
      manager_email: form.manager_email.trim(),
      date_joined: new Date().toISOString().slice(0, 10),
      risk_score: Number(form.risk_score),
      performance_rating: Number(form.performance_rating),
      potential_rating: Number(form.potential_rating),
      nine_box_quadrant: "Core Player",
      induction_status: 0,
      risk_drivers: [],
    });
    toast.success(`${form.name} added`);
    setOpen(false);
    setForm({ ...form, name: "", email: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add Employee</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="font-display">Add a team member</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Priya Sharma" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@fieldassist.com" /></div>
            <div className="space-y-1.5"><Label>Job title</Label><Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sub-department</Label>
              <Select value={form.sub_department} onValueChange={(v) => setForm({ ...form, sub_department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="Data">Data</SelectItem>
                  <SelectItem value="Platform">Platform</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Manager email</Label><Input value={form.manager_email} onChange={(e) => setForm({ ...form, manager_email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Performance (1-5)</Label><Input type="number" min={1} max={5} value={form.performance_rating} onChange={(e) => setForm({ ...form, performance_rating: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Potential (1-5)</Label><Input type="number" min={1} max={5} value={form.potential_rating} onChange={(e) => setForm({ ...form, potential_rating: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Risk (0-100)</Label><Input type="number" min={0} max={100} value={form.risk_score} onChange={(e) => setForm({ ...form, risk_score: Number(e.target.value) })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>Add to team</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommandCenter() {
  const { email, isAdmin } = useAuth();
  const { data: employees } = useEmployees();

  const total = employees.length;
  const avgRisk = total ? Math.round(employees.reduce((s, e) => s + e.risk_score, 0) / total) : 0;
  const newJoiners = employees.filter((e) => tenureDays(e.date_joined) < 90).length;
  const atRisk = employees.filter((e) => e.risk_score > 70).sort((a, b) => b.risk_score - a.risk_score);
  const stars = employees.filter((e) => e.nine_box_quadrant === "Star").length;

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-widest text-accent font-medium">
            {isAdmin ? "HRBP Command Center" : "Manager Command Center"}
          </div>
          <h1 className="font-display text-3xl md:text-4xl">Good to see you{email ? `, ${email.split("@")[0]}` : ""}.</h1>
          <p className="text-muted-foreground text-sm">A snapshot of your team's health, risk, and momentum.</p>
        </div>
        <AddEmployeeDialog defaultManager={email ?? "priya@fieldassist.com"} />
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi icon={Users} label="Total Team Size" value={total} sub={isAdmin ? "across all sub-departments" : "direct reports"} />
        <Kpi icon={TrendingUp} label="Avg Attrition Risk" value={avgRisk} sub={`/ 100`}
          tone={avgRisk >= 60 ? "warning" : avgRisk < 35 ? "good" : "default"} />
        <Kpi icon={UserPlus} label="New Joiners in Induction" value={newJoiners} sub="< 90 days tenure" />
        <Kpi icon={AlertTriangle} label="9-Box Stars" value={stars} sub="High perf · high potential" tone="good" />
      </div>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-xl">Attention Required</h2>
          <span className="text-xs text-muted-foreground">{atRisk.length} at risk · score &gt; 70</span>
        </div>
        {atRisk.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            No one above the 70 risk threshold. Keep the conversations flowing.
          </CardContent></Card>
        ) : (
          <Card><CardContent className="p-0 divide-y divide-border">
            {atRisk.map((e) => (
              <div key={e.id} className="flex flex-col md:flex-row md:items-center gap-3 p-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="size-10 rounded-full bg-accent/10 text-accent grid place-items-center font-medium flex-shrink-0">
                    {e.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{e.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {e.job_title} · {e.sub_department}
                    </div>
                    {e.risk_drivers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {e.risk_drivers.slice(0, 3).map((d) => (
                          <span key={d} className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{d}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 md:justify-end">
                  <RagBadge score={e.risk_score} />
                  <StayConversationButton employee={e} />
                </div>
              </div>
            ))}
          </CardContent></Card>
        )}
      </section>
    </div>
  );
}
