export type Employee = {
  emp_id: string;
  name: string;
  email: string | null;
  job_title: string | null;
  level: string | null;
  department: string;
  sub_vertical: string | null;
  joining_date: string;
  h2_rating: number;
  potential_rating: number;
  manager_email: string;
  rollup_manager_email: string | null;
  function_head_email: string | null;
  nine_box_quadrant: string;
  attrition_risk: number;
  rag_status: "green" | "amber" | "red";
  succession_notes: string | null;
  future_career_path: string | null;
  hrbp_insights: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  talent_segment: string | null;
  retention_risk_band: "low" | "medium" | "high" | "critical" | null;
  flight_risk_drivers: string[] | null;
  ai_readiness_score: number | null;
  ai_readiness_band: "AI Champion" | "AI Ready" | "AI Learner" | "AI Beginner" | null;
  leadership_readiness: "ready_now" | "ready_1y" | "ready_2y" | "ic_track" | null;
  ai_recommended_actions: string[] | null;
  ai_insight_generated_at: string | null;
  nine_box_override: string | null;
  new_joiner_exp_feedback: number | null;
  new_joiner_mgr_feedback: number | null;
  new_joiner_risk_score: number | null;
};

export const TALENT_SEGMENTS = [
  "Future Leaders", "Core Talent", "Watch List", "Retention Priority",
  "Emerging Talent", "Solid Contributors", "Performance Concern",
  "Flight Risk Stars", "Critical Intervention",
] as const;

export const SEGMENT_TONE: Record<string, "good" | "warning" | "danger" | "default"> = {
  "Future Leaders": "good", "Core Talent": "good", "Emerging Talent": "good",
  "Watch List": "warning", "Retention Priority": "warning", "Solid Contributors": "default",
  "Performance Concern": "warning", "Flight Risk Stars": "danger", "Critical Intervention": "danger",
};

export const LEADERSHIP_LABEL: Record<string, string> = {
  ready_now: "Ready Now", ready_1y: "Ready in 1 Year",
  ready_2y: "Ready in 2 Years", ic_track: "Individual Contributor",
};


export type AppRole = "hrbp_admin" | "function_head" | "rollup_manager" | "manager";

export const QUADRANTS = [
  "Star", "Key Player", "Question Mark",
  "High Performer", "Core Player", "Inconsistent",
  "Risk", "Solid Performer", "Iceberg",
] as const;

export type Quadrant = typeof QUADRANTS[number];

export const QUADRANT_DESC: Record<Quadrant, string> = {
  Star: "Future leader · perf 4-5 / pot 4-5",
  "Key Player": "Strong potential · perf 3 / pot 4-5",
  "Question Mark": "High capability, underperforming · perf 1-2 / pot 4-5",
  "High Performer": "Top contributor · perf 4-5 / pot 3",
  "Core Player": "Reliable & stable · perf 3 / pot 3",
  Inconsistent: "Performance gaps · perf 1-2 / pot 3",
  Risk: "Expert contributor · perf 4-5 / pot 1-2",
  "Solid Performer": "Dependable · perf 3 / pot 1-2",
  Iceberg: "Low perf, low potential · perf 1-2 / pot 1-2",
};

export function computeQuadrant(perf: number, pot: number): Quadrant {
  const pb = perf >= 3.5 ? "H" : perf >= 2.5 ? "M" : "L";
  const ob = pot >= 3.5 ? "H" : pot >= 2.5 ? "M" : "L";
  const map: Record<string, Quadrant> = {
    HH: "Star", MH: "Key Player", LH: "Question Mark",
    HM: "High Performer", MM: "Core Player", LM: "Inconsistent",
    HL: "Risk", ML: "Solid Performer", LL: "Iceberg",
  };
  return map[pb + ob];
}

export function rag(score: number): "green" | "amber" | "red" {
  if (score >= 65) return "red";
  if (score >= 40) return "amber";
  return "green";
}

export function tenureDays(dateJoined: string): number {
  return Math.floor((Date.now() - new Date(dateJoined).getTime()) / 86400000);
}

export function slugifyEmail(name: string, domain = "flick2know.com"): string {
  const s = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
  return `${s}@${domain}`;
}

export const ALLOWED_DOMAINS = ["flick2know.com", "fieldassist.in"] as const;
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const d = email.toLowerCase().split("@")[1];
  return ALLOWED_DOMAINS.includes(d as (typeof ALLOWED_DOMAINS)[number]);
}
