import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "microsoft" | "lovable",
      opts?: SignInOptions
    ) => {
      // Map 'lovable' fallback to google if needed, otherwise use provider
      const targetProvider = provider === "lovable" ? "google" : provider;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: targetProvider as "google" | "apple",
        options: {
          redirectTo: opts?.redirect_uri || `${window.location.origin}/`,
          queryParams: opts?.extraParams,
        },
      });

      if (error) {
        console.error("Supabase OAuth error:", error.message);
        return { error, redirected: false };
      }

      return { error: null, redirected: true, data };
    },
  },
};
