import { useEmployees } from "@/hooks/use-employees";
import { Database, AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function DataHealthBadge({ className }: { className?: string }) {
  const { source, sourceError, isLoading } = useEmployees();
  if (isLoading) return null;

  const cfg =
    source === "live"
      ? { label: "Live data", icon: Database, cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" }
      : source === "fallback"
      ? { label: "No data visible", icon: AlertTriangle, cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" }
      : { label: "Data error", icon: ShieldAlert, cls: "bg-red-500/10 text-red-600 border-red-500/30" };

  const Icon = cfg.icon;
  return (
    <div
      title={sourceError ?? cfg.label}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium",
        cfg.cls,
        className
      )}
    >
      <Icon className="size-3" />
      {cfg.label}
    </div>
  );
}
