// Local, deterministic stand-ins for the AI server functions.
import { mockStore } from "./mock-store";
import type { Employee } from "./types";

const RISK_KEYWORDS: Record<string, number> = {
  burnout: 25, "burn out": 25, exhausted: 18, overworked: 18,
  "competing offer": 30, "another offer": 30, leaving: 25, quit: 25, resign: 30,
  compensation: 15, salary: 15, underpaid: 20,
  "career growth": 12, stagnant: 15, bored: 12, "no growth": 18,
  "manager relationship": 18, "manager conflict": 22, micromanage: 15,
  workload: 12, deadlines: 10, "role clarity": 10,
  recognition: 8, "not appreciated": 12,
};

function driverFor(kw: string): string {
  if (kw.includes("offer")) return "competing offer";
  if (kw.includes("burn")) return "burnout";
  if (kw.includes("compensation") || kw.includes("salary") || kw.includes("underpaid")) return "compensation";
  if (kw.includes("growth") || kw.includes("stagnant") || kw.includes("bored")) return "career growth";
  if (kw.includes("manager") || kw.includes("micromanage")) return "manager relationship";
  if (kw.includes("workload") || kw.includes("overworked") || kw.includes("deadlines")) return "workload";
  if (kw.includes("recognition") || kw.includes("appreciated")) return "recognition";
  return "role clarity";
}

function ruleBased(note: string) {
  const lower = note.toLowerCase();
  let delta = 0;
  const drivers = new Set<string>();
  for (const [kw, w] of Object.entries(RISK_KEYWORDS)) {
    if (lower.includes(kw)) { delta += w; drivers.add(driverFor(kw)); }
  }
  return { delta: Math.min(delta, 60), drivers: [...drivers] };
}

function pickQuadrant(perf: number, pot: number): string {
  const p = perf >= 4 ? 2 : perf >= 3 ? 1 : 0; // col
  const q = pot >= 4 ? 2 : pot >= 3 ? 1 : 0; // row (higher = better)
  const grid = [
    ["Iceberg", "Solid Performer", "Risk"],
    ["Inconsistent", "Core Player", "High Performer"],
    ["Question Mark", "Key Player", "Star"],
  ];
  return grid[q][p];
}

export async function suggestStayQuestionsMock(employeeId: string): Promise<{ content: string }> {
  await new Promise((r) => setTimeout(r, 500));
  const emp = mockStore.getState().employees.find((e) => e.id === employeeId);
  if (!emp) throw new Error("Employee not found");
  const drivers = emp.risk_drivers.length ? emp.risk_drivers : ["unspecified concerns"];
  const driverPrompts: Record<string, string> = {
    burnout: "How sustainable does your current workload feel — and what would 'recharged' look like for you in the next month?",
    "career growth": "When you imagine your role 12 months from now, what's expanded? What feels stuck?",
    compensation: "Setting comp aside for a moment — what would make this role feel like the best one you've ever had?",
    "manager relationship": "What is one thing I could start, stop, or continue doing that would make our partnership stronger?",
    "competing offer": "What is the most exciting part of the alternative you're considering — and is there a version of that we can build here?",
    workload: "Which 2 things on your plate today drain you most, and which 2 energize you?",
    recognition: "When was the last time you felt your work was truly seen — and what made that moment land?",
    "role clarity": "If you had to draw your role on a napkin, what would the picture be — and what's currently fuzzy?",
  };
  const questions = drivers.slice(0, 4).map((d) => driverPrompts[d] ?? `Tell me more about how '${d}' is showing up for you right now.`);
  while (questions.length < 6) {
    questions.push(
      [
        "What would have to be true 6 months from now for you to feel this was the best year of your career?",
        "Where do you feel under-utilized today, and what would unlock it?",
        "What's one decision we've made recently that you'd reconsider — and why?",
        "Outside of work, what's competing for your energy right now?",
      ][questions.length % 4],
    );
  }
  const content = `## Stay Conversation Guide — ${emp.name}\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\n### Tone tips\n- Open with curiosity, not assessment — your goal is to learn, not solve.\n- Listen for 80% of the conversation. Reflect back what you heard before responding.`;
  return { content };
}

export async function analyzeOneOnOneNoteMock(employeeId: string, note: string, authorId: string) {
  await new Promise((r) => setTimeout(r, 600));
  const emp = mockStore.getState().employees.find((e) => e.id === employeeId);
  if (!emp) throw new Error("Employee not found");
  const { delta, drivers } = ruleBased(note);
  const risk_score = Math.max(0, Math.min(100, emp.risk_score + delta));
  // tiny perf/potential nudge based on tone
  const positive = /(great|crushing|grew|growth|promoted|excited|love)/i.test(note);
  const negative = /(struggl|missed|miss(ed)? deadline|unhappy|frustrat|burn)/i.test(note);
  const perf = Math.max(1, Math.min(5, emp.performance_rating + (positive ? 0.2 : negative ? -0.3 : 0)));
  const pot = Math.max(1, Math.min(5, emp.potential_rating + (positive ? 0.1 : 0)));
  const nine_box_quadrant = pickQuadrant(perf, pot);
  const merged = Array.from(new Set([...(emp.risk_drivers ?? []), ...drivers])).slice(0, 6);
  const summary =
    drivers.length === 0
      ? "Note logged. No new risk drivers detected; minor calibration applied."
      : `Detected ${drivers.join(", ")}. Risk adjusted by +${delta}.`;
  const patch: Partial<Employee> = {
    risk_score,
    nine_box_quadrant,
    risk_drivers: merged,
    last_analyzed_at: new Date().toISOString(),
  };
  mockStore.updateEmployee(employeeId, patch);
  mockStore.addNote({ employee_id: employeeId, author_id: authorId, note, ai_summary: summary });
  return { risk_score, nine_box_quadrant, drivers: merged, summary };
}
