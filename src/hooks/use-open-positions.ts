import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type OpenPosition = {
  id: string;
  title: string;
  department: string;
  sub_vertical: string | null;
  level: string | null;
  location: string | null;
  hiring_manager_email: string | null;
  opened_on: string;
  filled_on: string | null;
  status: string;
};

export function useOpenPositions() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["open-positions", user?.id ?? "anon"],
    enabled: !!user,
    queryFn: async (): Promise<OpenPosition[]> => {
      const { data, error } = await supabase.from("open_positions").select("*").order("opened_on", { ascending: false });
      if (error) {
        console.error("[useOpenPositions] Supabase error:", error);
        return [];
      }
      return (data ?? []) as unknown as OpenPosition[];
    },
  });
  return { data: query.data ?? [], isLoading: query.isLoading };
}
