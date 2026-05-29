import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Calculator, Info, Sparkles, ShieldAlert, Layers, Gauge } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RagBadge } from "@/components/Rag";

export const Route = createFileRoute("/_app/risk-methodology")({
  component: RiskMethodology,
});

// Mirror of weights in src/lib/mock-ai.ts — keep in sync.
const KEYWORD_TABLE: { driver: string; keywords: string[]; weight: number }[] = [
  { driver: "Competing offer", keywords: ["competing offer", "another offer", "resign"], weight: 30 },
  { driver: "Burnout", keywords: ["burnout", "burn out"], weight: 25 },
  { driver: "Quit intent", keywords: ["leaving", "quit"], weight: 25 },
  { driver: "Manager conflict", keywords: ["manager conflict"], weight: 22 },
  { driver: "Underpaid", keywords: ["underpaid"], weight: 20 },
  { driver: "Exhaustion / overwork", keywords: ["exhausted", "overworked"], weight: 18 },
  { driver: "Manager relationship", keywords: ["manager relationship"], weight: 18 },
  { driver: "No growth signal", keywords: ["no growth"], weight: 18 },
  { driver: "Compensation", keywords: ["compensation", "salary"], weight: 15 },
  { driver: "Stagnation / micromanage", keywords: ["stagnant", "micromanage"], weight: 15 },
  { driver: "Career growth / boredom", keywords: ["career growth", "bored"], weight: 12 },
  { driver: "Workload / recognition gap", keywords: ["workload", "not appreciated"], weight: 12 },
  { driver: "Deadlines / role clarity", keywords: ["deadlines", "role clarity"], weight: 10 },
  { driver: "Recognition", keywords: ["recognition"], weight: 8 },
];

const SAMPLE = "Priya mentioned she's exhausted, feels there's no growth in her current track, and hinted at a competing offer from another company.";

function scoreNote(note: string) {
  const lower = note.toLowerCase();
  const hits: { driver: string; keyword: string; weight: number }[] = [];
  KEYWORD_TABLE.forEach((row) => {
    row.keywords.forEach((kw) => {
      if (lower.includes(kw)) hits.push({ driver: row.driver, keyword: kw, weight: row.weight });
    });
  });
  const raw = hits.reduce((s, h) => s + h.weight, 0);
  const capped = Math.min(raw, 60);
  return { hits, raw, capped };
}

function ScoreDial({ value }: { value: number }) {
  const band = value >= 70 ? "red" : value >= 40 ? "amber" : "green";
  const color = band === "red" ? "bg-destructive" : band === "amber" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <div>
          <div className="text-5xl font-display font-semibold tabular-nums">{value}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">out of 100</div>
        </div>
        <RagBadge score={value} />
      </div>
      <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>0 · Healthy</span><span>40 · Watch</span><span>70 · Act now</span><span>100</span>
      </div>
    </div>
  );
}

function RiskMethodology() {
  const [baseline, setBaseline] = useState(45);
  const [note, setNote] = useState(SAMPLE);
  const result = useMemo(() => scoreNote(note), [note]);
  const finalScore = Math.max(0, Math.min(100, baseline + result.capped));

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
          <Calculator className="size-3.5" /> Methodology
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-semibold">How the Risk Score is calculated</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          A transparent breakdown of the 0–100 retention-risk signal that powers the Attrition Radar.
          Every component, every weight, no black box.
        </p>
      </div>

      {/* Two layer overview */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="size-4 text-primary" />
              <h2 className="font-display font-semibold">Layer 1 — Baseline</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Each employee carries a current <span className="font-medium text-foreground">risk_score</span> seeded from HRIS signals
              (tenure, engagement survey, performance trend). This is the "last known" risk before any new conversation lands.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-4 text-primary" />
              <h2 className="font-display font-semibold">Layer 2 — Live signal from 1-on-1 notes</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              When you log a 1-on-1 note, an NLP pass scans for risk keywords across 8 driver categories,
              sums the weights, applies a per-note cap, and produces a delta that updates the baseline.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Formula */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="size-4 text-primary" />
            <h2 className="font-display font-semibold">The formula</h2>
          </div>
          <pre className="bg-secondary/50 rounded-lg p-4 text-sm font-mono overflow-x-auto">
{`new_score = clamp( 0, 100,  baseline  +  min( 60, Σ keyword_weights )  )`}
          </pre>
          <ul className="text-sm text-muted-foreground mt-4 space-y-1.5 list-disc list-inside">
            <li>Each matched keyword contributes a fixed weight (see table below).</li>
            <li>A single note can add at most <span className="font-medium text-foreground">+60 points</span> — no single conversation can max out the score.</li>
            <li>Score is clamped to <span className="font-medium text-foreground">0–100</span>.</li>
            <li>Matched keywords also become <span className="font-medium text-foreground">risk drivers</span> (max 6 per employee).</li>
            <li>Tone words (e.g. "great", "frustrated") nudge performance ±0.2–0.3 and re-derive the 9-box quadrant.</li>
          </ul>
        </CardContent>
      </Card>

      {/* RAG bands */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="size-4 text-primary" />
            <h2 className="font-display font-semibold">RAG bands</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-4">
              <RagBadge score={20} />
              <div className="text-2xl font-display font-semibold mt-2">0 – 39</div>
              <p className="text-xs text-muted-foreground mt-1">Healthy. Continue regular cadence.</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <RagBadge score={55} />
              <div className="text-2xl font-display font-semibold mt-2">40 – 69</div>
              <p className="text-xs text-muted-foreground mt-1">Watchlist. Schedule a stay conversation.</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <RagBadge score={80} />
              <div className="text-2xl font-display font-semibold mt-2">70 – 100</div>
              <p className="text-xs text-muted-foreground mt-1">Act now. Escalate to HRBP and skip-level.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keyword weight table */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Info className="size-4 text-primary" />
              <h2 className="font-display font-semibold">Keyword weight library</h2>
            </div>
            <span className="text-xs text-muted-foreground">Sorted high → low impact</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4">Driver</th>
                  <th className="py-2 pr-4">Keywords detected</th>
                  <th className="py-2 pr-4 w-40">Weight</th>
                </tr>
              </thead>
              <tbody>
                {KEYWORD_TABLE.sort((a, b) => b.weight - a.weight).map((row) => (
                  <tr key={row.driver} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4 font-medium">{row.driver}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1.5">
                        {row.keywords.map((k) => (
                          <Badge key={k} variant="secondary" className="font-mono text-[11px]">{k}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <Progress value={(row.weight / 30) * 100} className="h-1.5 w-24" />
                        <span className="font-mono text-sm tabular-nums w-10">+{row.weight}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Interactive simulator */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="size-4 text-primary" />
            <h2 className="font-display font-semibold">Try it: score a 1-on-1 note</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Paste any note and adjust the baseline. The score updates live — no employee data changes.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Current baseline</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="range" min={0} max={100} value={baseline}
                    onChange={(e) => setBaseline(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="font-mono tabular-nums w-10 text-right">{baseline}</span>
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">1-on-1 note</label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={8}
                  className="mt-1 font-sans"
                  placeholder="Paste a 1-on-1 note here..."
                />
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setNote(SAMPLE)}>
                  Load sample
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4 bg-secondary/30">
                <ScoreDial value={finalScore} />
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Breakdown</div>
                <div className="space-y-1.5 text-sm font-mono">
                  <div className="flex justify-between"><span className="text-muted-foreground">Baseline</span><span>{baseline}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Raw delta (Σ weights)</span><span>+{result.raw}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">After +60 cap</span><span>+{result.capped}</span></div>
                  <div className="flex justify-between border-t border-border pt-1.5 mt-1.5 font-semibold"><span>Final score</span><span>{finalScore}</span></div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Keywords matched ({result.hits.length})
                </div>
                {result.hits.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No risk keywords detected in this note.</p>
                ) : (
                  <div className="space-y-1.5">
                    {result.hits.map((h, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono text-[11px]">{h.keyword}</Badge>
                          <span className="text-muted-foreground text-xs">→ {h.driver}</span>
                        </div>
                        <span className="font-mono tabular-nums text-sm">+{h.weight}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Production note */}
      <Card className="border-dashed">
        <CardContent className="p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Pilot vs Production</div>
          <p className="text-sm text-muted-foreground">
            This pilot uses deterministic keyword scoring so every decision is auditable. The production
            build layers an LLM calibration pass on top (Gemini 3 Flash) that refines the score, picks the
            9-box quadrant, and writes a one-line summary — so a short, mild note produces a small
            adjustment rather than always hitting the keyword ceiling.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
