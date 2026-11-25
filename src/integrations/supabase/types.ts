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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      booking_requests: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          reason: string | null
          previous_booking_status: string | null
          replacement_name: string | null
          replacement_whatsapp: string | null
          request_type: string
          status: string
          user_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          reason?: string | null
          previous_booking_status?: string | null
          replacement_name?: string | null
          replacement_whatsapp?: string | null
          request_type: string
          status?: string
          user_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          replacement_name?: string | null
          replacement_whatsapp?: string | null
          request_type?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_admin_actions: {
        Row: {
          action: string
          actor_id: string
          booking_id: string
          created_at: string
          id: string
          reason: string | null
          request_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          booking_id: string
          created_at?: string
          id?: string
          reason?: string | null
          request_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          booking_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_admin_actions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_admin_actions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "booking_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount: number
          channel: string
          code: string
          created_at: string
          event_id: string
          id: string
          level: string
          paid_at: string | null
          payment_expires_at: string | null
          payment_method: string | null
          payment_proof_path: string | null
          payment_proof_uploaded_at: string | null
          player_name: string
          qr_string: string | null
          status: string
          updated_at: string
          user_id: string
          waitlist_position: number | null
          waitlist_offered_at: string | null
          waitlist_offer_expires_at: string | null
          whatsapp: string
          xendit_qr_id: string | null
        }
        Insert: {
          amount?: number
          channel?: string
          code?: string
          created_at?: string
          event_id: string
          id?: string
          level: string
          paid_at?: string | null
          payment_expires_at?: string | null
          payment_method?: string | null
          payment_proof_path?: string | null
          payment_proof_uploaded_at?: string | null
          player_name: string
          qr_string?: string | null
          status: string
          updated_at?: string
          user_id: string
          waitlist_position?: number | null
          waitlist_offered_at?: string | null
          waitlist_offer_expires_at?: string | null
          whatsapp: string
          xendit_qr_id?: string | null
        }
        Update: {
          amount?: number
          channel?: string
          code?: string
          created_at?: string
          event_id?: string
          id?: string
          level?: string
          paid_at?: string | null
          payment_expires_at?: string | null
          payment_method?: string | null
          payment_proof_path?: string | null
          payment_proof_uploaded_at?: string | null
          player_name?: string
          qr_string?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          waitlist_position?: number | null
          waitlist_offered_at?: string | null
          waitlist_offer_expires_at?: string | null
          whatsapp?: string
          xendit_qr_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string
          base_filled: number
          courts: string[]
          created_at: string
          event_type: string
          id: string
          is_featured: boolean
          maps_url: string
          price: number
          quota_max: number
          starts_at: string
          time_slots: string
          title: string
          venue: string
        }
        Insert: {
          address?: string
          base_filled?: number
          courts?: string[]
          created_at?: string
          event_type?: string
          id?: string
          is_featured?: boolean
          maps_url?: string
          price: number
          quota_max: number
          starts_at: string
          time_slots: string
          title: string
          venue?: string
        }
        Update: {
          address?: string
          base_filled?: number
          courts?: string[]
          created_at?: string
          event_type?: string
          id?: string
          is_featured?: boolean
          maps_url?: string
          price?: number
          quota_max?: number
          starts_at?: string
          time_slots?: string
          title?: string
          venue?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          kind: string
          message: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: string
          message: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: string
          message?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          code: string
          created_at: string
          id: string
          note: string | null
          product_id: string
          product_name: string
          quantity: number
          size: string | null
          status: string
          total: number
          unit_price: number
          user_id: string
        }
        Insert: {
          code?: string
          created_at?: string
          id?: string
          note?: string | null
          product_id: string
          product_name: string
          quantity: number
          size?: string | null
          status?: string
          total: number
          unit_price: number
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          note?: string | null
          product_id?: string
          product_name?: string
          quantity?: number
          size?: string | null
          status?: string
          total?: number
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          badge: string | null
          category: string
          created_at: string
          description: string
          id: string
          name: string
          price: number
          sizes: string[]
          slug: string
          sort_order: number
          stock: number
        }
        Insert: {
          badge?: string | null
          category: string
          created_at?: string
          description?: string
          id?: string
          name: string
          price: number
          sizes?: string[]
          slug: string
          sort_order?: number
          stock?: number
        }
        Update: {
          badge?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          price?: number
          sizes?: string[]
          slug?: string
          sort_order?: number
          stock?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          level: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          level?: string
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          level?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      admin_review_booking: {
        Args: { _action: string; _booking_id: string; _reason?: string | null; _request_id?: string | null }
        Returns: Json
      }
      book_event: {
        Args: {
          _event_id: string
          _level: string
          _payment_method: string
          _player_name: string
          _whatsapp: string
        }
        Returns: {
          amount: number
          channel: string
          code: string
          created_at: string
          event_id: string
          id: string
          level: string
          paid_at: string | null
          payment_expires_at: string | null
          payment_method: string | null
          payment_proof_path: string | null
          payment_proof_uploaded_at: string | null
          player_name: string
          qr_string: string | null
          status: string
          updated_at: string
          user_id: string
          waitlist_position: number | null
          waitlist_offered_at: string | null
          waitlist_offer_expires_at: string | null
          whatsapp: string
          xendit_qr_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_qris_payment: {
        Args: { _amount: number; _qr_id: string; _reference: string }
        Returns: {
          amount: number
          channel: string
          code: string
          created_at: string
          event_id: string
          id: string
          level: string
          paid_at: string | null
          payment_expires_at: string | null
          payment_method: string | null
          payment_proof_path: string | null
          payment_proof_uploaded_at: string | null
          player_name: string
          qr_string: string | null
          status: string
          updated_at: string
          user_id: string
          waitlist_position: number | null
          waitlist_offered_at: string | null
          waitlist_offer_expires_at: string | null
          whatsapp: string
          xendit_qr_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accept_waitlist_offer: {
        Args: { _booking_id: string; _payment_method: string }
        Returns: Json
      }
      event_quota: {
        Args: never
        Returns: {
          event_id: string
          filled: number
          waitlist: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      place_order: {
        Args: {
          _note: string
          _product_id: string
          _quantity: number
          _size: string
        }
        Returns: {
          code: string
          created_at: string
          id: string
          note: string | null
          product_id: string
          product_name: string
          quantity: number
          size: string | null
          status: string
          total: number
          unit_price: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_booking_transfer_proof: {
        Args: { _booking_id: string; _proof_path: string }
        Returns: Json
      }
      request_booking_change: {
        Args: {
          _booking_id: string
          _reason: string
          _replacement_name: string
          _replacement_whatsapp: string
          _request_type: string
        }
        Returns: {
          booking_id: string
          created_at: string
          id: string
          reason: string | null
          previous_booking_status: string | null
          replacement_name: string | null
          replacement_whatsapp: string | null
          request_type: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "booking_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
