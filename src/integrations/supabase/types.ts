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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      areas: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          certificate_code: string
          completion_date: string
          course_name: string
          created_at: string
          enrollment_id: string
          id: string
          issue_date: string
          qr_code_data: string
          status: string
          student_name: string
          updated_at: string
          verification_url: string
        }
        Insert: {
          certificate_code: string
          completion_date: string
          course_name: string
          created_at?: string
          enrollment_id: string
          id?: string
          issue_date?: string
          qr_code_data: string
          status?: string
          student_name: string
          updated_at?: string
          verification_url: string
        }
        Update: {
          certificate_code?: string
          completion_date?: string
          course_name?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          issue_date?: string
          qr_code_data?: string
          status?: string
          student_name?: string
          updated_at?: string
          verification_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "pre_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          area_id: string | null
          brief_description: string | null
          created_at: string
          description: string | null
          duration_days: number | null
          duration_hours: number | null
          end_date: string | null
          enrollment_fee: number | null
          id: string
          image_url: string | null
          modules: string | null
          name: string
          pre_enrollment_fee: number | null
          price: number | null
          published: boolean
          slug: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          brief_description?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number | null
          duration_hours?: number | null
          end_date?: string | null
          enrollment_fee?: number | null
          id?: string
          image_url?: string | null
          modules?: string | null
          name: string
          pre_enrollment_fee?: number | null
          price?: number | null
          published?: boolean
          slug: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          brief_description?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number | null
          duration_hours?: number | null
          end_date?: string | null
          enrollment_fee?: number | null
          id?: string
          image_url?: string | null
          modules?: string | null
          name?: string
          pre_enrollment_fee?: number | null
          price?: number | null
          published?: boolean
          slug?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_declarations: {
        Row: {
          content: string
          generated_at: string
          id: string
          pre_enrollment_id: string
        }
        Insert: {
          content: string
          generated_at?: string
          id?: string
          pre_enrollment_id: string
        }
        Update: {
          content?: string
          generated_at?: string
          id?: string
          pre_enrollment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_declarations_pre_enrollment_id_fkey"
            columns: ["pre_enrollment_id"]
            isOneToOne: true
            referencedRelation: "pre_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          course_id: string
          created_at: string
          enrollment_amount: number | null
          enrollment_date: string | null
          enrollment_payment_id: string | null
          id: string
          payment_status: string
          pre_enrollment_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          enrollment_amount?: number | null
          enrollment_date?: string | null
          enrollment_payment_id?: string | null
          id?: string
          payment_status?: string
          pre_enrollment_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          enrollment_amount?: number | null
          enrollment_date?: string | null
          enrollment_payment_id?: string | null
          id?: string
          payment_status?: string
          pre_enrollment_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_enrollment_payment_id_fkey"
            columns: ["enrollment_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_pre_enrollment_id_fkey"
            columns: ["pre_enrollment_id"]
            isOneToOne: true
            referencedRelation: "pre_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          asaas_api_key: string | null
          asaas_api_key_production: string | null
          asaas_api_key_sandbox: string | null
          asaas_webhook_token: string | null
          created_at: string
          currency: string
          enabled: boolean | null
          environment: string | null
          fixed_price: number | null
          id: string
          payment_description: string | null
          pricing_type: string
          updated_at: string
        }
        Insert: {
          asaas_api_key?: string | null
          asaas_api_key_production?: string | null
          asaas_api_key_sandbox?: string | null
          asaas_webhook_token?: string | null
          created_at?: string
          currency?: string
          enabled?: boolean | null
          environment?: string | null
          fixed_price?: number | null
          id?: string
          payment_description?: string | null
          pricing_type?: string
          updated_at?: string
        }
        Update: {
          asaas_api_key?: string | null
          asaas_api_key_production?: string | null
          asaas_api_key_sandbox?: string | null
          asaas_webhook_token?: string | null
          created_at?: string
          currency?: string
          enabled?: boolean | null
          environment?: string | null
          fixed_price?: number | null
          id?: string
          payment_description?: string | null
          pricing_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          asaas_payment_id: string | null
          created_at: string
          currency: string
          enrollment_id: string | null
          error_message: string | null
          id: string
          kind: string
          paid_at: string | null
          pix_expiration_date: string | null
          pix_payload: string | null
          pix_qr_code: string | null
          pre_enrollment_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          asaas_payment_id?: string | null
          created_at?: string
          currency?: string
          enrollment_id?: string | null
          error_message?: string | null
          id?: string
          kind?: string
          paid_at?: string | null
          pix_expiration_date?: string | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          pre_enrollment_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          asaas_payment_id?: string | null
          created_at?: string
          currency?: string
          enrollment_id?: string | null
          error_message?: string | null
          id?: string
          kind?: string
          paid_at?: string | null
          pix_expiration_date?: string | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          pre_enrollment_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_pre_enrollment_id_fkey"
            columns: ["pre_enrollment_id"]
            isOneToOne: false
            referencedRelation: "pre_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_enrollments: {
        Row: {
          additional_info: string | null
          address: string | null
          address_number: string | null
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          birth_date: string | null
          city: string | null
          complement: string | null
          course_id: string
          cpf: string | null
          created_at: string
          education_level: string | null
          email: string
          enrollment_declaration_url: string | null
          full_name: string
          id: string
          license_duration: string | null
          license_end_date: string | null
          license_start_date: string | null
          organ_approval_confirmed: boolean
          organ_approval_date: string | null
          organ_approval_notes: string | null
          organ_approval_status: string | null
          organization: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          study_plan_url: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          additional_info?: string | null
          address?: string | null
          address_number?: string | null
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          birth_date?: string | null
          city?: string | null
          complement?: string | null
          course_id: string
          cpf?: string | null
          created_at?: string
          education_level?: string | null
          email: string
          enrollment_declaration_url?: string | null
          full_name: string
          id?: string
          license_duration?: string | null
          license_end_date?: string | null
          license_start_date?: string | null
          organ_approval_confirmed?: boolean
          organ_approval_date?: string | null
          organ_approval_notes?: string | null
          organ_approval_status?: string | null
          organization?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          study_plan_url?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          additional_info?: string | null
          address?: string | null
          address_number?: string | null
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          birth_date?: string | null
          city?: string | null
          complement?: string | null
          course_id?: string
          cpf?: string | null
          created_at?: string
          education_level?: string | null
          email?: string
          enrollment_declaration_url?: string | null
          full_name?: string
          id?: string
          license_duration?: string | null
          license_end_date?: string | null
          license_start_date?: string | null
          organ_approval_confirmed?: boolean
          organ_approval_date?: string | null
          organ_approval_notes?: string | null
          organ_approval_status?: string | null
          organization?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          study_plan_url?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pre_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          address_number: string | null
          birth_date: string | null
          city: string | null
          complement: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          postal_code: string | null
          role: Database["public"]["Enums"]["user_role"]
          state: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          birth_date?: string | null
          city?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          postal_code?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          state?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          address_number?: string | null
          birth_date?: string | null
          city?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          postal_code?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          state?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      study_plans: {
        Row: {
          content: string
          generated_at: string
          id: string
          pre_enrollment_id: string
        }
        Insert: {
          content: string
          generated_at?: string
          id?: string
          pre_enrollment_id: string
        }
        Update: {
          content?: string
          generated_at?: string
          id?: string
          pre_enrollment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plans_pre_enrollment_id_fkey"
            columns: ["pre_enrollment_id"]
            isOneToOne: true
            referencedRelation: "pre_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          abed_seal_url: string | null
          certificate_back_bg_url: string | null
          certificate_front_bg_url: string | null
          created_at: string
          director_name: string | null
          director_signature_url: string | null
          director_title: string | null
          id: string
          institution_address: string | null
          institution_cep: string | null
          institution_cnpj: string | null
          institution_email: string | null
          institution_name: string | null
          institution_phone: string | null
          institution_website: string | null
          logo_url: string | null
          n8n_webhook_url: string | null
          updated_at: string
          webhook_events: string[] | null
        }
        Insert: {
          abed_seal_url?: string | null
          certificate_back_bg_url?: string | null
          certificate_front_bg_url?: string | null
          created_at?: string
          director_name?: string | null
          director_signature_url?: string | null
          director_title?: string | null
          id?: string
          institution_address?: string | null
          institution_cep?: string | null
          institution_cnpj?: string | null
          institution_email?: string | null
          institution_name?: string | null
          institution_phone?: string | null
          institution_website?: string | null
          logo_url?: string | null
          n8n_webhook_url?: string | null
          updated_at?: string
          webhook_events?: string[] | null
        }
        Update: {
          abed_seal_url?: string | null
          certificate_back_bg_url?: string | null
          certificate_front_bg_url?: string | null
          created_at?: string
          director_name?: string | null
          director_signature_url?: string | null
          director_title?: string | null
          id?: string
          institution_address?: string | null
          institution_cep?: string | null
          institution_cnpj?: string | null
          institution_email?: string | null
          institution_name?: string | null
          institution_phone?: string | null
          institution_website?: string | null
          logo_url?: string | null
          n8n_webhook_url?: string | null
          updated_at?: string
          webhook_events?: string[] | null
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          enrollment_id: string | null
          event_type: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          success: boolean
          webhook_url: string
        }
        Insert: {
          created_at?: string
          enrollment_id?: string | null
          event_type: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_url: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string | null
          event_type?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "pre_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      enrollment_status:
        | "pending"
        | "approved"
        | "rejected"
        | "pending_payment"
        | "payment_confirmed"
      user_role: "admin" | "student"
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
      enrollment_status: [
        "pending",
        "approved",
        "rejected",
        "pending_payment",
        "payment_confirmed",
      ],
      user_role: ["admin", "student"],
    },
  },
} as const
