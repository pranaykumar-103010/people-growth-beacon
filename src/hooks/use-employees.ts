import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Employee } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";

export type EmployeesSource = "live" | "fallback" | "error";

export type EmployeesResult = {
  data: Employee[];
  source: EmployeesSource;
  error?: string;
};

export function useEmployees() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["employees", user?.id ?? "anon"],
    enabled: !!user,
    queryFn: async (): Promise<EmployeesResult> => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("attrition_risk", { ascending: false });
      if (error) {
        console.error("[useEmployees] Supabase error:", error);
        return { data: [], source: "error", error: error.message };
      }
      const rows = (data ?? []) as unknown as Employee[];
      if (rows.length === 0) {
        console.warn("[useEmployees] No rows returned — RLS may be filtering, or table empty.");
        return { data: [], source: "fallback" };
      }
      return { data: rows, source: "live" };
    },
  });

  return {
    ...query,
    data: query.data?.data ?? [],
    source: query.data?.source ?? ("fallback" as EmployeesSource),
    sourceError: query.data?.error,
  };
}
