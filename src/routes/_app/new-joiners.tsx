import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useEmployees } from "@/hooks/use-employees";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { tenureDays } from "@/lib/types";
import { formatDistanceToNowStrict } from "date-fns";

export const Route = createFileRoute("/_app/new-joiners")({
  component: NewJoinerTracker,
});

function NewJoinerTracker() {
  const { data: employees = [], isLoading } = useEmployees();
  const joiners = useMemo(() =>
    employees
      .filter((e) => tenureDays(e.date_joined) < 90)
      .sort((a, b) => tenureDays(b.date_joined) - tenureDays(a.date_joined)),
    [employees],
  );

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-accent font-medium">New Joiner Tracker</div>
        <h1 className="font-display text-3xl md:text-4xl">First 90 days · induction status</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {joiners.length} {joiners.length === 1 ? "person" : "people"} currently in their first 90 days.
        </p>
      </header>

      {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> :
        joiners.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">
            No active new joiners right now.
          </CardContent></Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {joiners.map((e) => {
              const days = tenureDays(e.date_joined);
              const onTrack = e.induction_status >= (days / 90) * 100 - 10;
              return (
                <Card key={e.id}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-display text-lg">{e.name}</div>
                        <div className="text-xs text-muted-foreground">{e.job_title} · {e.sub_department}</div>
                      </div>
                      <div className={`text-xs px-2 py-0.5 rounded-full border ${onTrack ? "bg-rag-green/10 text-rag-green border-rag-green/30" : "bg-rag-amber/15 text-[oklch(0.45_0.15_60)] border-rag-amber/30"}`}>
                        {onTrack ? "On track" : "Lagging"}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Induction progress</span>
                        <span className="font-medium">{e.induction_status}%</span>
                      </div>
                      <Progress value={e.induction_status} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground pt-1">
                      <span>Joined {formatDistanceToNowStrict(new Date(e.date_joined), { addSuffix: true })}</span>
                      <span>Day {days} of 90</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      }
    </div>
  );
}
