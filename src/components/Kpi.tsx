import { Card, CardContent } from "@/components/ui/card";

export function KpiCard({ icon: Icon, label, value, sub, tone, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "warning" | "good" | "danger";
  onClick?: () => void;
}) {
  const accent = tone === "warning" ? "text-rag-amber bg-rag-amber/10"
    : tone === "good" ? "text-rag-green bg-rag-green/10"
    : tone === "danger" ? "text-rag-red bg-rag-red/10" : "text-accent bg-accent/10";
  return (
    <Card
      onClick={onClick}
      className={`shadow-sm ring-1 ring-border border-0 ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition" : ""}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
            <div className="mt-1.5 font-display text-3xl text-foreground">{value}</div>
            {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
            {onClick && <div className="mt-0.5 text-[11px] text-accent">View details →</div>}
          </div>
          <div className={`size-9 rounded-md grid place-items-center flex-shrink-0 ${accent}`}>
            <Icon className="size-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
