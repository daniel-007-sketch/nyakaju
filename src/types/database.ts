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
      bookings: {
        Row: {
          admin_notes: string | null
          arrival_date: string
          confirmed_at: string | null
          confirmation_code: string
          created_at: string
          currency: string
          departure_date: string
          guest_email: string
          guest_first_name: string
          guest_last_name: string
          guest_phone: string
          id: number
          nightly_rate: number
          room_count: number
          room_type_id: number
          status: string
          status_updated_at: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          arrival_date: string
          confirmed_at?: string | null
          confirmation_code: string
          created_at?: string
          currency?: string
          departure_date: string
          guest_email: string
          guest_first_name: string
          guest_last_name: string
          guest_phone: string
          id?: number
          nightly_rate: number
          room_count?: number
          room_type_id: number
          status?: string
          status_updated_at?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          arrival_date?: string
          confirmed_at?: string | null
          confirmation_code?: string
          created_at?: string
          currency?: string
          departure_date?: string
          guest_email?: string
          guest_first_name?: string
          guest_last_name?: string
          guest_phone?: string
          id?: number
          nightly_rate?: number
          room_count?: number
          room_type_id?: number
          status?: string
          status_updated_at?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      room_images: {
        Row: {
          alt_text: string
          created_at: string
          display_order: number
          id: number
          is_primary: boolean
          room_type_id: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          alt_text?: string
          created_at?: string
          display_order?: number
          id?: number
          is_primary?: boolean
          room_type_id: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          alt_text?: string
          created_at?: string
          display_order?: number
          id?: number
          is_primary?: boolean
          room_type_id?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_images_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      room_types: {
        Row: {
          bathrooms: number
          beds: number
          created_at: string
          currency: string
          description: string
          display_order: number
          id: number
          is_active: boolean
          name: string
          nightly_rate: number
          slug: string
          total_units: number
          updated_at: string
        }
        Insert: {
          bathrooms?: number
          beds?: number
          created_at?: string
          currency?: string
          description?: string
          display_order?: number
          id?: number
          is_active?: boolean
          name: string
          nightly_rate: number
          slug: string
          total_units: number
          updated_at?: string
        }
        Update: {
          bathrooms?: number
          beds?: number
          created_at?: string
          currency?: string
          description?: string
          display_order?: number
          id?: number
          is_active?: boolean
          name?: string
          nightly_rate?: number
          slug?: string
          total_units?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_booking_request: {
        Args: {
          p_arrival_date: string
          p_departure_date: string
          p_guest_email: string
          p_guest_first_name: string
          p_guest_last_name: string
          p_guest_phone: string
          p_room_count: number
          p_room_type_id: number
        }
        Returns: {
          booked_nightly_rate: number
          booking_confirmation_code: string
          booking_currency: string
          booking_status: string
          booking_total_amount: number
          remaining_units: number
        }[]
      }
      get_room_availability: {
        Args: { p_arrival_date: string; p_departure_date: string }
        Returns: {
          available_units: number
          reserved_units: number
          room_type_id: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
