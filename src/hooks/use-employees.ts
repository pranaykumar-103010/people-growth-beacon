// Front-end mock — reads employees from local store, scoped by manager email unless admin.
import { useMockStore } from "@/lib/mock-store";
import type { Employee } from "@/lib/types";

export function useEmployees() {
  const user = useMockStore((s) => s.user);
  const all = useMockStore((s) => s.employees);
  const data: Employee[] = !user
    ? []
    : user.isAdmin
      ? [...all]
      : all.filter((e) => e.manager_email.toLowerCase() === user.email.toLowerCase());
  data.sort((a, b) => b.risk_score - a.risk_score);
  return { data, isLoading: false } as const;
}
