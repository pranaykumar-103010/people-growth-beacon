export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          actor_email: string
          emp_id: string
          field: string
          id: string
          new_value: string | null
          occurred_at: string
          old_value: string | null
        }
        Insert: {
          actor_email: string
          emp_id: string
          field: string
          id?: string
          new_value?: string | null
          occurred_at?: string
          old_value?: string | null
        }
        Update: {
          actor_email?: string
          emp_id?: string
          field?: string
          id?: string
          new_value?: string | null
          occurred_at?: string
          old_value?: string | null
        }
        Relationships: []
      }
      department_insights: {
        Row: {
          actions: string[]
          created_at: string
          department: string
          generated_by: string | null
          id: string
          risks: string[]
          strengths: string[]
          summary: string | null
          updated_at: string
        }
        Insert: {
          actions?: string[]
          created_at?: string
          department: string
          generated_by?: string | null
          id?: string
          risks?: string[]
          strengths?: string[]
          summary?: string | null
          updated_at?: string
        }
        Update: {
          actions?: string[]
          created_at?: string
          department?: string
          generated_by?: string | null
          id?: string
          risks?: string[]
          strengths?: string[]
          summary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      employee_directory: {
        Row: {
          created_at: string
          display_name: string
          email: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          active: boolean
          ai_insight_generated_at: string | null
          ai_readiness_band: string | null
          ai_readiness_score: number | null
          ai_recommended_actions: string[] | null
          attrition_risk: number
          created_at: string
          department: string
          email: string | null
          emp_id: string
          flight_risk_drivers: string[] | null
          function_head_email: string | null
          future_career_path: string | null
          h2_rating: number
          hrbp_insights: string | null
          job_title: string | null
          joining_date: string
          leadership_readiness: string | null
          level: string | null
          manager_email: string
          name: string
          nine_box_quadrant: string
          potential_rating: number
          rag_status: string
          retention_risk_band: string | null
          rollup_manager_email: string | null
          sub_vertical: string | null
          succession_notes: string | null
          talent_segment: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          ai_insight_generated_at?: string | null
          ai_readiness_band?: string | null
          ai_readiness_score?: number | null
          ai_recommended_actions?: string[] | null
          attrition_risk?: number
          created_at?: string
          department?: string
          email?: string | null
          emp_id: string
          flight_risk_drivers?: string[] | null
          function_head_email?: string | null
          future_career_path?: string | null
          h2_rating?: number
          hrbp_insights?: string | null
          job_title?: string | null
          joining_date?: string
          leadership_readiness?: string | null
          level?: string | null
          manager_email: string
          name: string
          nine_box_quadrant?: string
          potential_rating?: number
          rag_status?: string
          retention_risk_band?: string | null
          rollup_manager_email?: string | null
          sub_vertical?: string | null
          succession_notes?: string | null
          talent_segment?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          ai_insight_generated_at?: string | null
          ai_readiness_band?: string | null
          ai_readiness_score?: number | null
          ai_recommended_actions?: string[] | null
          attrition_risk?: number
          created_at?: string
          department?: string
          email?: string | null
          emp_id?: string
          flight_risk_drivers?: string[] | null
          function_head_email?: string | null
          future_career_path?: string | null
          h2_rating?: number
          hrbp_insights?: string | null
          job_title?: string | null
          joining_date?: string
          leadership_readiness?: string | null
          level?: string | null
          manager_email?: string
          name?: string
          nine_box_quadrant?: string
          potential_rating?: number
          rag_status?: string
          retention_risk_band?: string | null
          rollup_manager_email?: string | null
          sub_vertical?: string | null
          succession_notes?: string | null
          talent_segment?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hrbp_notes: {
        Row: {
          ai_summary: string | null
          author_id: string
          created_at: string
          employee_id: string
          id: string
          note: string
        }
        Insert: {
          ai_summary?: string | null
          author_id: string
          created_at?: string
          employee_id: string
          id?: string
          note: string
        }
        Update: {
          ai_summary?: string | null
          author_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "hrbp_notes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["emp_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_emp: {
        Args: {
          _emp_email: string
          _emp_fh: string
          _emp_mgr: string
          _emp_rollup: string
          _viewer_email: string
        }
        Returns: boolean
      }
      can_view_emp_v2: {
        Args: {
          _emp_email: string
          _emp_fh: string
          _emp_id: string
          _emp_mgr: string
          _emp_rollup: string
          _viewer_email: string
        }
        Returns: boolean
      }
      compute_quadrant: {
        Args: { _perf: number; _pot: number }
        Returns: string
      }
      compute_talent_fields: { Args: never; Returns: undefined }
      current_user_email: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_in_rollup_chain: {
        Args: { _emp_id: string; _viewer_email: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "hrbp_admin" | "manager" | "function_head" | "rollup_manager"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["hrbp_admin", "manager", "function_head", "rollup_manager"],
    },
  },
} as const
