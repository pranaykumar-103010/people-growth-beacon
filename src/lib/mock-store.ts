// Front-end-only mock store: employees + notes + auth, persisted to localStorage.
import { useSyncExternalStore } from "react";
import type { Employee } from "./types";

export type MockUser = { id: string; email: string; isAdmin: boolean };
export type MockNote = {
  id: string;
  employee_id: string;
  author_id: string;
  note: string;
  ai_summary: string | null;
  created_at: string;
};

type State = {
  user: MockUser | null;
  employees: Employee[];
  notes: MockNote[];
};

const LS_KEY = "talent-iq-mock-v1";
const listeners = new Set<() => void>();
let state: State = load();

function uid() {
  return (crypto as any)?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function seedEmployees(): Employee[] {
  const now = new Date().toISOString();
  const base = (
    p: Partial<Employee> & { name: string; sub_department: string; job_title: string; manager_email: string; date_joined: string; risk_score: number; performance_rating: number; potential_rating: number; nine_box_quadrant: string; induction_status: number; risk_drivers: string[]; email: string },
  ): Employee => ({
    id: uid(),
    last_analyzed_at: null,
    created_at: now,
    updated_at: now,
    ...p,
  });

  return [
    // Engineering — Priya
    base({ name: "Karan Mehta", email: "karan@fieldassist.com", sub_department: "Engineering", job_title: "Senior Software Engineer", manager_email: "priya@fieldassist.com", date_joined: daysAgo(820), risk_score: 82, performance_rating: 4, potential_rating: 4, nine_box_quadrant: "High Performer", induction_status: 100, risk_drivers: ["burnout", "career growth"] }),
    base({ name: "Sneha Iyer", email: "sneha@fieldassist.com", sub_department: "Engineering", job_title: "Staff Engineer", manager_email: "priya@fieldassist.com", date_joined: daysAgo(1500), risk_score: 28, performance_rating: 5, potential_rating: 5, nine_box_quadrant: "Star", induction_status: 100, risk_drivers: [] }),
    base({ name: "Arjun Rao", email: "arjun@fieldassist.com", sub_department: "Engineering", job_title: "Software Engineer II", manager_email: "priya@fieldassist.com", date_joined: daysAgo(420), risk_score: 55, performance_rating: 3, potential_rating: 4, nine_box_quadrant: "Key Player", induction_status: 100, risk_drivers: ["compensation"] }),
    base({ name: "Megha Shah", email: "megha@fieldassist.com", sub_department: "Engineering", job_title: "Engineering Manager", manager_email: "priya@fieldassist.com", date_joined: daysAgo(1100), risk_score: 18, performance_rating: 5, potential_rating: 4, nine_box_quadrant: "High Performer", induction_status: 100, risk_drivers: [] }),
    base({ name: "Vikas Pillai", email: "vikas@fieldassist.com", sub_department: "Engineering", job_title: "Software Engineer", manager_email: "priya@fieldassist.com", date_joined: daysAgo(45), risk_score: 32, performance_rating: 3, potential_rating: 3, nine_box_quadrant: "Core Player", induction_status: 55, risk_drivers: [] }),
    base({ name: "Ananya Bose", email: "ananya@fieldassist.com", sub_department: "Engineering", job_title: "QA Engineer", manager_email: "priya@fieldassist.com", date_joined: daysAgo(900), risk_score: 74, performance_rating: 2, potential_rating: 2, nine_box_quadrant: "Risk", induction_status: 100, risk_drivers: ["manager relationship", "recognition"] }),
    base({ name: "Rohit Desai", email: "rohit@fieldassist.com", sub_department: "Engineering", job_title: "DevOps Engineer", manager_email: "priya@fieldassist.com", date_joined: daysAgo(70), risk_score: 22, performance_rating: 4, potential_rating: 3, nine_box_quadrant: "Solid Performer", induction_status: 78, risk_drivers: [] }),
    base({ name: "Pooja Nair", email: "pooja@fieldassist.com", sub_department: "Engineering", job_title: "Frontend Engineer", manager_email: "priya@fieldassist.com", date_joined: daysAgo(610), risk_score: 41, performance_rating: 4, potential_rating: 4, nine_box_quadrant: "High Performer", induction_status: 100, risk_drivers: ["workload"] }),

    // Data — Rahul
    base({ name: "Nikhil Verma", email: "nikhil@fieldassist.com", sub_department: "Data", job_title: "Data Scientist", manager_email: "rahul@fieldassist.com", date_joined: daysAgo(540), risk_score: 78, performance_rating: 4, potential_rating: 5, nine_box_quadrant: "Star", induction_status: 100, risk_drivers: ["competing offer", "compensation"] }),
    base({ name: "Riya Kapoor", email: "riya@fieldassist.com", sub_department: "Data", job_title: "Senior Data Engineer", manager_email: "rahul@fieldassist.com", date_joined: daysAgo(1300), risk_score: 30, performance_rating: 5, potential_rating: 4, nine_box_quadrant: "High Performer", induction_status: 100, risk_drivers: [] }),
    base({ name: "Sandeep Joshi", email: "sandeep@fieldassist.com", sub_department: "Data", job_title: "Analytics Lead", manager_email: "rahul@fieldassist.com", date_joined: daysAgo(750), risk_score: 48, performance_rating: 3, potential_rating: 4, nine_box_quadrant: "Key Player", induction_status: 100, risk_drivers: ["role clarity"] }),
    base({ name: "Tanvi Sharma", email: "tanvi@fieldassist.com", sub_department: "Data", job_title: "ML Engineer", manager_email: "rahul@fieldassist.com", date_joined: daysAgo(60), risk_score: 25, performance_rating: 4, potential_rating: 4, nine_box_quadrant: "High Performer", induction_status: 65, risk_drivers: [] }),
    base({ name: "Harish Kumar", email: "harish@fieldassist.com", sub_department: "Data", job_title: "Data Analyst", manager_email: "rahul@fieldassist.com", date_joined: daysAgo(380), risk_score: 62, performance_rating: 2, potential_rating: 3, nine_box_quadrant: "Inconsistent", induction_status: 100, risk_drivers: ["career growth"] }),
    base({ name: "Divya Menon", email: "divya@fieldassist.com", sub_department: "Data", job_title: "Data Engineer", manager_email: "rahul@fieldassist.com", date_joined: daysAgo(220), risk_score: 35, performance_rating: 3, potential_rating: 3, nine_box_quadrant: "Core Player", induction_status: 100, risk_drivers: [] }),
    base({ name: "Suresh Reddy", email: "suresh@fieldassist.com", sub_department: "Data", job_title: "BI Developer", manager_email: "rahul@fieldassist.com", date_joined: daysAgo(15), risk_score: 18, performance_rating: 3, potential_rating: 3, nine_box_quadrant: "Core Player", induction_status: 20, risk_drivers: [] }),

    // Platform — Anjali
    base({ name: "Aditya Singh", email: "aditya@fieldassist.com", sub_department: "Platform", job_title: "Product Manager", manager_email: "anjali@fieldassist.com", date_joined: daysAgo(940), risk_score: 24, performance_rating: 5, potential_rating: 5, nine_box_quadrant: "Star", induction_status: 100, risk_drivers: [] }),
    base({ name: "Kavya Reddy", email: "kavya@fieldassist.com", sub_department: "Platform", job_title: "Senior Product Designer", manager_email: "anjali@fieldassist.com", date_joined: daysAgo(640), risk_score: 71, performance_rating: 4, potential_rating: 4, nine_box_quadrant: "High Performer", induction_status: 100, risk_drivers: ["burnout", "manager relationship"] }),
    base({ name: "Manish Gupta", email: "manish@fieldassist.com", sub_department: "Platform", job_title: "Platform Engineer", manager_email: "anjali@fieldassist.com", date_joined: daysAgo(290), risk_score: 44, performance_rating: 3, potential_rating: 4, nine_box_quadrant: "Key Player", induction_status: 100, risk_drivers: ["workload"] }),
    base({ name: "Shreya Pillai", email: "shreya@fieldassist.com", sub_department: "Platform", job_title: "UX Researcher", manager_email: "anjali@fieldassist.com", date_joined: daysAgo(180), risk_score: 33, performance_rating: 4, potential_rating: 4, nine_box_quadrant: "High Performer", induction_status: 100, risk_drivers: [] }),
    base({ name: "Rajesh Khanna", email: "rajeshk@fieldassist.com", sub_department: "Platform", job_title: "Solutions Architect", manager_email: "anjali@fieldassist.com", date_joined: daysAgo(1700), risk_score: 50, performance_rating: 3, potential_rating: 3, nine_box_quadrant: "Core Player", induction_status: 100, risk_drivers: ["recognition"] }),
    base({ name: "Neha Agarwal", email: "neha@fieldassist.com", sub_department: "Platform", job_title: "Product Designer", manager_email: "anjali@fieldassist.com", date_joined: daysAgo(35), risk_score: 28, performance_rating: 4, potential_rating: 4, nine_box_quadrant: "High Performer", induction_status: 42, risk_drivers: [] }),
    base({ name: "Gaurav Malhotra", email: "gaurav@fieldassist.com", sub_department: "Platform", job_title: "Mobile Engineer", manager_email: "anjali@fieldassist.com", date_joined: daysAgo(800), risk_score: 67, performance_rating: 2, potential_rating: 2, nine_box_quadrant: "Iceberg", induction_status: 100, risk_drivers: ["career growth", "compensation"] }),
    base({ name: "Ishita Roy", email: "ishita@fieldassist.com", sub_department: "Platform", job_title: "Associate PM", manager_email: "anjali@fieldassist.com", date_joined: daysAgo(85), risk_score: 30, performance_rating: 3, potential_rating: 5, nine_box_quadrant: "Question Mark", induction_status: 88, risk_drivers: [] }),
  ];
}

function load(): State {
  if (typeof window === "undefined") {
    return { user: null, employees: seedEmployees(), notes: [] };
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const fresh: State = { user: null, employees: seedEmployees(), notes: [] };
  localStorage.setItem(LS_KEY, JSON.stringify(fresh));
  return fresh;
}

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

export const mockStore = {
  getState: () => state,
  subscribe: (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  signIn: (email: string, isAdmin = false) => {
    state = { ...state, user: { id: "mock-" + email, email, isAdmin } };
    emit();
  },
  signOut: () => {
    state = { ...state, user: null };
    emit();
  },
  setAdmin: (isAdmin: boolean) => {
    if (!state.user) return;
    state = { ...state, user: { ...state.user, isAdmin } };
    emit();
  },
  addEmployee: (e: Omit<Employee, "id" | "created_at" | "updated_at" | "last_analyzed_at">) => {
    const now = new Date().toISOString();
    const emp: Employee = { ...e, id: uid(), created_at: now, updated_at: now, last_analyzed_at: null };
    state = { ...state, employees: [emp, ...state.employees] };
    emit();
    return emp;
  },
  updateEmployee: (id: string, patch: Partial<Employee>) => {
    state = {
      ...state,
      employees: state.employees.map((e) =>
        e.id === id ? { ...e, ...patch, updated_at: new Date().toISOString() } : e,
      ),
    };
    emit();
  },
  addNote: (n: Omit<MockNote, "id" | "created_at">) => {
    state = {
      ...state,
      notes: [{ ...n, id: uid(), created_at: new Date().toISOString() }, ...state.notes],
    };
    emit();
  },
  reset: () => {
    state = { user: null, employees: seedEmployees(), notes: [] };
    emit();
  },
};

export function useMockStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    mockStore.subscribe,
    () => selector(state),
    () => selector(state),
  );
}
