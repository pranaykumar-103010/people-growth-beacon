import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Employee } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";

export function useEmployees() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["employees", user?.id ?? "anon"],
    enabled: !!user,
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("attrition_risk", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Employee[];
    },
  });
}
