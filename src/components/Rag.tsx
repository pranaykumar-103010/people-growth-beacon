import { cn } from "@/lib/utils";
import { rag } from "@/lib/types";

export function RagDot({ score, className }: { score: number; className?: string }) {
  const c = rag(score);
  const color = c === "red" ? "bg-rag-red" : c === "amber" ? "bg-rag-amber" : "bg-rag-green";
  return <span className={cn("inline-block size-2.5 rounded-full", color, className)} />;
}

export function RagBadge({ score }: { score: number }) {
  const c = rag(score);
  const styles =
    c === "red" ? "bg-rag-red/10 text-rag-red border-rag-red/30"
    : c === "amber" ? "bg-rag-amber/15 text-[oklch(0.45_0.15_60)] border-rag-amber/30"
    : "bg-rag-green/10 text-rag-green border-rag-green/30";
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium", styles)}>
      <RagDot score={score} /> {score}
    </span>
  );
}
