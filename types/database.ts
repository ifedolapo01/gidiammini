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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      discounts: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          name: string
          notified_phases: Json | null
          scope: string
          start_date: string | null
          target_id: string | null
          type: string
          value: number
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notified_phases?: Json | null
          scope: string
          start_date?: string | null
          target_id?: string | null
          type: string
          value: number
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notified_phases?: Json | null
          scope?: string
          start_date?: string | null
          target_id?: string | null
          type?: string
          value?: number
        }
        Relationships: []
      }
      order_change_requests: {
        Row: {
          admin_response: string | null
          created_at: string | null
          customer_note: string | null
          details: Json
          id: string
          order_id: string
          request_type: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string | null
          customer_note?: string | null
          details?: Json
          id?: string
          order_id: string
          request_type: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string | null
          customer_note?: string | null
          details?: Json
          id?: string
          order_id?: string
          request_type?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_change_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          color: string | null
          created_at: string
          id: string
          order_id: string | null
          price: number
          product_id: string | null
          product_name: string
          quantity: number
          size: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          price: number
          product_id?: string | null
          product_name: string
          quantity: number
          size?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_at: string | null
          id: string
          order_id: string
          status: string
        }
        Insert: {
          changed_at?: string | null
          id?: string
          order_id: string
          status: string
        }
        Update: {
          changed_at?: string | null
          id?: string
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          city: string | null
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          delivery_address: string | null
          delivery_option: string
          id: string
          note: string | null
          order_number: string
          payment_reminder_sent_at: string | null
          payment_verified: boolean
          receipt_path: string | null
          receipt_url: string | null
          reserved_until: string | null
          selected_lga: string | null
          selected_place: string | null
          selected_state: string
          shipping_zone_id: string | null
          status: string
          stock_reserved: boolean
          total_amount: number
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          delivery_address?: string | null
          delivery_option: string
          id?: string
          note?: string | null
          order_number: string
          payment_reminder_sent_at?: string | null
          payment_verified?: boolean
          receipt_path?: string | null
          receipt_url?: string | null
          reserved_until?: string | null
          selected_lga?: string | null
          selected_place?: string | null
          selected_state: string
          shipping_zone_id?: string | null
          status?: string
          stock_reserved?: boolean
          total_amount: number
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          delivery_address?: string | null
          delivery_option?: string
          id?: string
          note?: string | null
          order_number?: string
          payment_reminder_sent_at?: string | null
          payment_verified?: boolean
          receipt_path?: string | null
          receipt_url?: string | null
          reserved_until?: string | null
          selected_lga?: string | null
          selected_place?: string | null
          selected_state?: string
          shipping_zone_id?: string | null
          status?: string
          stock_reserved?: boolean
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_shipping_zone_id_fkey"
            columns: ["shipping_zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          colors: string[] | null
          created_at: string
          description: string | null
          details: string[] | null
          id: string
          images: string[] | null
          is_active: boolean
          main_image: string
          name: string
          price: number
          pricing_config: Json | null
          sizes: string[] | null
          sizing_type: string | null
          stock: number
          sub_category: string | null
          updated_at: string
        }
        Insert: {
          category: string
          colors?: string[] | null
          created_at?: string
          description?: string | null
          details?: string[] | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          main_image: string
          name: string
          price: number
          pricing_config?: Json | null
          sizes?: string[] | null
          sizing_type?: string | null
          stock?: number
          sub_category?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          colors?: string[] | null
          created_at?: string
          description?: string | null
          details?: string[] | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          main_image?: string
          name?: string
          price?: number
          pricing_config?: Json | null
          sizes?: string[] | null
          sizing_type?: string | null
          stock?: number
          sub_category?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shipping_zone_exceptions: {
        Row: {
          created_at: string | null
          delivery_eta_max: number | null
          delivery_eta_min: number | null
          delivery_eta_unit: string | null
          delivery_fee: number | null
          id: string
          is_active: boolean
          lga: string | null
          parent_zone_id: string
          places: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_eta_max?: number | null
          delivery_eta_min?: number | null
          delivery_eta_unit?: string | null
          delivery_fee?: number | null
          id?: string
          is_active?: boolean
          lga?: string | null
          parent_zone_id: string
          places?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_eta_max?: number | null
          delivery_eta_min?: number | null
          delivery_eta_unit?: string | null
          delivery_fee?: number | null
          id?: string
          is_active?: boolean
          lga?: string | null
          parent_zone_id?: string
          places?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_zone_exceptions_parent_zone_id_fkey"
            columns: ["parent_zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zones: {
        Row: {
          contact_phone: string | null
          created_at: string | null
          delivery_eta_max: number
          delivery_eta_min: number
          delivery_eta_unit: string
          delivery_fee: number
          delivery_label: string
          id: string
          is_active: boolean
          is_door_delivery: boolean
          is_primary: boolean
          lga: string | null
          name: string
          pickup_address: string | null
          pickup_available: boolean
          places: string | null
          sort_order: number
          state: string
          updated_at: string | null
        }
        Insert: {
          contact_phone?: string | null
          created_at?: string | null
          delivery_eta_max?: number
          delivery_eta_min?: number
          delivery_eta_unit?: string
          delivery_fee?: number
          delivery_label?: string
          id?: string
          is_active?: boolean
          is_door_delivery?: boolean
          is_primary?: boolean
          lga?: string | null
          name: string
          pickup_address?: string | null
          pickup_available?: boolean
          places?: string | null
          sort_order?: number
          state: string
          updated_at?: string | null
        }
        Update: {
          contact_phone?: string | null
          created_at?: string | null
          delivery_eta_max?: number
          delivery_eta_min?: number
          delivery_eta_unit?: string
          delivery_fee?: number
          delivery_label?: string
          id?: string
          is_active?: boolean
          is_door_delivery?: boolean
          is_primary?: boolean
          lga?: string | null
          name?: string
          pickup_address?: string | null
          pickup_available?: boolean
          places?: string | null
          sort_order?: number
          state?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category_slug: string
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          category_slug: string
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          category_slug?: string
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          password_hash: string
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          password_hash: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          password_hash?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_order_stock: {
        Args: { p_items: Json; p_reserve: boolean }
        Returns: Json
      }
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
