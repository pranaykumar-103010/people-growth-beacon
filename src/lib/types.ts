export type Employee = {
  id: string;
  name: string;
  email: string | null;
  sub_department: string;
  job_title: string | null;
  manager_email: string;
  date_joined: string;
  risk_score: number;
  performance_rating: number;
  potential_rating: number;
  nine_box_quadrant: string;
  induction_status: number;
  risk_drivers: string[];
  last_analyzed_at: string | null;
  created_at: string;
  updated_at: string;
};

export const QUADRANTS = [
  "Star", "High Performer", "Core Player",
  "Question Mark", "Key Player", "Solid Performer",
  "Risk", "Inconsistent", "Iceberg",
] as const;

export function rag(score: number): "green" | "amber" | "red" {
  if (score >= 70) return "red";
  if (score >= 40) return "amber";
  return "green";
}

export function tenureDays(dateJoined: string): number {
  return Math.floor((Date.now() - new Date(dateJoined).getTime()) / 86400000);
}
