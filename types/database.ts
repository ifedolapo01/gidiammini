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
      abandoned_carts: {
        Row: {
          abandoned_at: string
          created_at: string
          customer_id: string | null
          email: string
          first_sent_at: string | null
          full_name: string | null
          id: string
          items: Json
          opted_out: boolean
          phone: string | null
          recovered_at: string | null
          second_sent_at: string | null
          token_hash: string
          updated_at: string
        }
        Insert: {
          abandoned_at?: string
          created_at?: string
          customer_id?: string | null
          email: string
          first_sent_at?: string | null
          full_name?: string | null
          id?: string
          items?: Json
          opted_out?: boolean
          phone?: string | null
          recovered_at?: string | null
          second_sent_at?: string | null
          token_hash: string
          updated_at?: string
        }
        Update: {
          abandoned_at?: string
          created_at?: string
          customer_id?: string | null
          email?: string
          first_sent_at?: string | null
          full_name?: string | null
          id?: string
          items?: Json
          opted_out?: boolean
          phone?: string | null
          recovered_at?: string | null
          second_sent_at?: string | null
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_stats"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "abandoned_carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          deactivated_at: string | null
          email: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean
          last_seen_at: string | null
          name: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deactivated_at?: string | null
          email: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          last_seen_at?: string | null
          name?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deactivated_at?: string | null
          email?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          last_seen_at?: string | null
          name?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          method: string | null
          path: string | null
          reason: string | null
          status_code: number | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          method?: string | null
          path?: string | null
          reason?: string | null
          status_code?: number | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          method?: string | null
          path?: string | null
          reason?: string | null
          status_code?: number | null
        }
        Relationships: []
      }
      automation_rule_runs: {
        Row: {
          detail: string | null
          first_run_at: string
          id: string
          outcome: string
          ran_at: string
          rule_id: string
          subject_id: string
          subject_label: string | null
          subject_type: string
          times_run: number
        }
        Insert: {
          detail?: string | null
          first_run_at?: string
          id?: string
          outcome?: string
          ran_at?: string
          rule_id: string
          subject_id: string
          subject_label?: string | null
          subject_type: string
          times_run?: number
        }
        Update: {
          detail?: string | null
          first_run_at?: string
          id?: string
          outcome?: string
          ran_at?: string
          rule_id?: string
          subject_id?: string
          subject_label?: string | null
          subject_type?: string
          times_run?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_rule_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action: string
          action_config: Json
          cooldown_hours: number | null
          created_at: string
          description: string
          id: string
          is_active: boolean
          key: string | null
          last_run_at: string | null
          last_run_note: string | null
          name: string
          trigger: string
          trigger_config: Json
          updated_at: string
        }
        Insert: {
          action: string
          action_config?: Json
          cooldown_hours?: number | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          key?: string | null
          last_run_at?: string | null
          last_run_note?: string | null
          name: string
          trigger: string
          trigger_config?: Json
          updated_at?: string
        }
        Update: {
          action?: string
          action_config?: Json
          cooldown_hours?: number | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          key?: string | null
          last_run_at?: string | null
          last_run_note?: string | null
          name?: string
          trigger?: string
          trigger_config?: Json
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string | null
          display_name: string | null
          id: string
          name: string
          size_guidance: string | null
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          name: string
          size_guidance?: string | null
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          name?: string
          size_guidance?: string | null
          slug?: string
        }
        Relationships: []
      }
      customer_auth_tokens: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at?: string
          id?: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_auth_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_stats"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_auth_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_sessions: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          last_seen_at: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at?: string
          id?: string
          last_seen_at?: string
          token_hash: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          last_seen_at?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_stats"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_wishlist: {
        Row: {
          created_at: string
          customer_id: string
          last_seen_stock: number | null
          price_notified_at: string | null
          product_id: string
          reference_price: number | null
          stock_notified_at: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          last_seen_stock?: number | null
          price_notified_at?: string | null
          product_id: string
          reference_price?: number | null
          stock_notified_at?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          last_seen_stock?: number | null
          price_notified_at?: string | null
          product_id?: string
          reference_price?: number | null
          stock_notified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_wishlist_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_stats"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_wishlist_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_wishlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "most_wishlisted"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "customer_wishlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          blocked_reason: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_blocked: boolean
          notes: string | null
          phone_e164: string | null
          phone_raw: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          blocked_reason?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          notes?: string | null
          phone_e164?: string | null
          phone_raw?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          blocked_reason?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          notes?: string | null
          phone_e164?: string | null
          phone_raw?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      discount_redemptions: {
        Row: {
          amount_saved: number
          created_at: string
          customer_id: string | null
          discount_id: string
          email: string
          id: string
          order_id: string
        }
        Insert: {
          amount_saved?: number
          created_at?: string
          customer_id?: string | null
          discount_id: string
          email: string
          id?: string
          order_id: string
        }
        Update: {
          amount_saved?: number
          created_at?: string
          customer_id?: string | null
          discount_id?: string
          email?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_stats"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "discount_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_cancellations"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "discount_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          code: string | null
          created_at: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          max_redemptions: number | null
          min_order_value: number
          name: string
          notified_phases: Json | null
          per_customer_limit: number | null
          redemption_count: number
          scope: string
          start_date: string | null
          target_id: string | null
          type: string
          value: number
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_redemptions?: number | null
          min_order_value?: number
          name: string
          notified_phases?: Json | null
          per_customer_limit?: number | null
          redemption_count?: number
          scope: string
          start_date?: string | null
          target_id?: string | null
          type: string
          value: number
        }
        Update: {
          code?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_redemptions?: number | null
          min_order_value?: number
          name?: string
          notified_phases?: Json | null
          per_customer_limit?: number | null
          redemption_count?: number
          scope?: string
          start_date?: string | null
          target_id?: string | null
          type?: string
          value?: number
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          actor_id: string | null
          created_at: string
          delta: number
          id: string
          note: string | null
          product_id: string
          reason: string
          reference_id: string | null
          reference_type: string | null
          stock_after: number
          variant_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          delta: number
          id?: string
          note?: string | null
          product_id: string
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          stock_after: number
          variant_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          product_id?: string
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          stock_after?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "most_wishlisted"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          channel: string
          created_at: string
          customer_id: string | null
          failure_detail: string | null
          failure_reason: string | null
          id: string
          kind: string
          order_id: string | null
          provider_message_id: string | null
          recipient: string
          resend_of: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          channel: string
          created_at?: string
          customer_id?: string | null
          failure_detail?: string | null
          failure_reason?: string | null
          id?: string
          kind: string
          order_id?: string | null
          provider_message_id?: string | null
          recipient: string
          resend_of?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          channel?: string
          created_at?: string
          customer_id?: string | null
          failure_detail?: string | null
          failure_reason?: string | null
          id?: string
          kind?: string
          order_id?: string | null
          provider_message_id?: string | null
          recipient?: string
          resend_of?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_stats"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_cancellations"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_resend_of_fkey"
            columns: ["resend_of"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "order_cancellations"
            referencedColumns: ["order_id"]
          },
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
          base_price: number | null
          color: string | null
          created_at: string
          discount_id: string | null
          id: string
          order_id: string | null
          price: number
          product_id: string | null
          product_name: string
          quantity: number
          size: string | null
          variant_id: string | null
        }
        Insert: {
          base_price?: number | null
          color?: string | null
          created_at?: string
          discount_id?: string | null
          id?: string
          order_id?: string | null
          price: number
          product_id?: string | null
          product_name: string
          quantity: number
          size?: string | null
          variant_id?: string | null
        }
        Update: {
          base_price?: number | null
          color?: string | null
          created_at?: string
          discount_id?: string | null
          id?: string
          order_id?: string | null
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          size?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_cancellations"
            referencedColumns: ["order_id"]
          },
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
            referencedRelation: "most_wishlisted"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_number_reservations: {
        Row: {
          created_at: string
          idempotency_key: string
          order_number: string
        }
        Insert: {
          created_at?: string
          idempotency_key: string
          order_number: string
        }
        Update: {
          created_at?: string
          idempotency_key?: string
          order_number?: string
        }
        Relationships: []
      }
      order_payments: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          amount: number
          created_at: string
          id: string
          method: string
          note: string | null
          order_id: string
          reason_code: string | null
          receipt_path: string | null
          received_at: string
          reference: string | null
          status: string
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          order_id: string
          reason_code?: string | null
          receipt_path?: string | null
          received_at?: string
          reference?: string | null
          status: string
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          order_id?: string
          reason_code?: string | null
          receipt_path?: string | null
          received_at?: string
          reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_cancellations"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_refunds: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          amount: number
          created_at: string
          id: string
          method: string
          note: string | null
          order_id: string
          reason_code: string
          reference: string | null
          refunded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          amount: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          order_id: string
          reason_code: string
          reference?: string | null
          refunded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          order_id?: string
          reason_code?: string
          reference?: string | null
          refunded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_cancellations"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_review_invites: {
        Row: {
          created_at: string
          expires_at: string
          order_id: string
          sent_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          order_id: string
          sent_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          order_id?: string
          sent_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_review_invites_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "order_cancellations"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_review_invites_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          changed_at: string | null
          id: string
          order_id: string
          reason: string | null
          reason_code: string | null
          status: string
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          changed_at?: string | null
          id?: string
          order_id: string
          reason?: string | null
          reason_code?: string | null
          status: string
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          changed_at?: string | null
          id?: string
          order_id?: string
          reason?: string | null
          reason_code?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_cancellations"
            referencedColumns: ["order_id"]
          },
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
          amount_paid: number
          amount_refunded: number
          carrier: string | null
          city: string | null
          created_at: string
          customer_email: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          customer_phone_digits: string | null
          delivery_address: string | null
          delivery_option: string
          discount_amount: number
          discount_reason: string | null
          id: string
          idempotency_key: string | null
          items_subtotal: number
          note: string | null
          order_number: string
          paid_at: string | null
          payment_channel: string | null
          payment_method: string
          payment_reference: string | null
          payment_reminder_sent_at: string | null
          payment_verified: boolean
          receipt_path: string | null
          receipt_url: string | null
          reserved_until: string | null
          selected_lga: string | null
          selected_place: string | null
          selected_state: string
          shipping_amount: number
          shipping_zone_id: string | null
          status: string
          stock_reserved: boolean
          tax_amount: number
          total_amount: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          amount_refunded?: number
          carrier?: string | null
          city?: string | null
          created_at?: string
          customer_email: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          customer_phone_digits?: string | null
          delivery_address?: string | null
          delivery_option: string
          discount_amount?: number
          discount_reason?: string | null
          id?: string
          idempotency_key?: string | null
          items_subtotal?: number
          note?: string | null
          order_number: string
          paid_at?: string | null
          payment_channel?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_reminder_sent_at?: string | null
          payment_verified?: boolean
          receipt_path?: string | null
          receipt_url?: string | null
          reserved_until?: string | null
          selected_lga?: string | null
          selected_place?: string | null
          selected_state: string
          shipping_amount?: number
          shipping_zone_id?: string | null
          status?: string
          stock_reserved?: boolean
          tax_amount?: number
          total_amount: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          amount_refunded?: number
          carrier?: string | null
          city?: string | null
          created_at?: string
          customer_email?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          customer_phone_digits?: string | null
          delivery_address?: string | null
          delivery_option?: string
          discount_amount?: number
          discount_reason?: string | null
          id?: string
          idempotency_key?: string | null
          items_subtotal?: number
          note?: string | null
          order_number?: string
          paid_at?: string | null
          payment_channel?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_reminder_sent_at?: string | null
          payment_verified?: boolean
          receipt_path?: string | null
          receipt_url?: string | null
          reserved_until?: string | null
          selected_lga?: string | null
          selected_place?: string | null
          selected_state?: string
          shipping_amount?: number
          shipping_zone_id?: string | null
          status?: string
          stock_reserved?: boolean
          tax_amount?: number
          total_amount?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_stats"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_zone_id_fkey"
            columns: ["shipping_zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          amount_kobo: number | null
          event: string
          id: string
          order_id: string | null
          outcome: string
          payload: Json
          provider: string
          received_at: string
          reference: string
          transaction_id: string | null
        }
        Insert: {
          amount_kobo?: number | null
          event: string
          id?: string
          order_id?: string | null
          outcome: string
          payload: Json
          provider?: string
          received_at?: string
          reference: string
          transaction_id?: string | null
        }
        Update: {
          amount_kobo?: number | null
          event?: string
          id?: string
          order_id?: string | null
          outcome?: string
          payload?: Json
          provider?: string
          received_at?: string
          reference?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_cancellations"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pairs: {
        Row: {
          co_purchase_count: number
          computed_at: string
          product_id: string
          related_product_id: string
        }
        Insert: {
          co_purchase_count: number
          computed_at?: string
          product_id: string
          related_product_id: string
        }
        Update: {
          co_purchase_count?: number
          computed_at?: string
          product_id?: string
          related_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_pairs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "most_wishlisted"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_pairs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pairs_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "most_wishlisted"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_pairs_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_questions: {
        Row: {
          answer: string | null
          answer_notified_at: string | null
          answered_at: string | null
          answered_by: string | null
          asker_email: string
          asker_name: string
          body: string
          created_at: string
          id: string
          moderation_note: string | null
          product_id: string
          published_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          answer_notified_at?: string | null
          answered_at?: string | null
          answered_by?: string | null
          asker_email: string
          asker_name: string
          body: string
          created_at?: string
          id?: string
          moderation_note?: string | null
          product_id: string
          published_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          answer_notified_at?: string | null
          answered_at?: string | null
          answered_by?: string | null
          asker_email?: string
          asker_name?: string
          body?: string
          created_at?: string
          id?: string
          moderation_note?: string | null
          product_id?: string
          published_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "most_wishlisted"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          admin_responded_at: string | null
          admin_response: string | null
          author_email: string
          author_name: string
          body: string | null
          created_at: string
          id: string
          is_verified_purchase: boolean
          moderation_note: string | null
          order_id: string | null
          photo_paths: string[]
          product_id: string
          published_at: string | null
          rating: number
          status: string
          title: string | null
          updated_at: string
          variant_label: string | null
        }
        Insert: {
          admin_responded_at?: string | null
          admin_response?: string | null
          author_email: string
          author_name: string
          body?: string | null
          created_at?: string
          id?: string
          is_verified_purchase?: boolean
          moderation_note?: string | null
          order_id?: string | null
          photo_paths?: string[]
          product_id: string
          published_at?: string | null
          rating: number
          status?: string
          title?: string | null
          updated_at?: string
          variant_label?: string | null
        }
        Update: {
          admin_responded_at?: string | null
          admin_response?: string | null
          author_email?: string
          author_name?: string
          body?: string | null
          created_at?: string
          id?: string
          is_verified_purchase?: boolean
          moderation_note?: string | null
          order_id?: string | null
          photo_paths?: string[]
          product_id?: string
          published_at?: string | null
          rating?: number
          status?: string
          title?: string | null
          updated_at?: string
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_cancellations"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "most_wishlisted"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          color: string | null
          cost: number | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          price: number
          product_id: string
          size: string | null
          sku: string | null
          stock: number
          updated_at: string
          variant_key: string | null
        }
        Insert: {
          barcode?: string | null
          color?: string | null
          cost?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          price?: number
          product_id: string
          size?: string | null
          sku?: string | null
          stock?: number
          updated_at?: string
          variant_key?: string | null
        }
        Update: {
          barcode?: string | null
          color?: string | null
          cost?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          price?: number
          product_id?: string
          size?: string | null
          sku?: string | null
          stock?: number
          updated_at?: string
          variant_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "most_wishlisted"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          fit_note: string | null
          fit_rating: string | null
          id: string
          images: string[] | null
          is_active: boolean
          main_image: string
          name: string
          price: number
          pricing_config: Json | null
          search_vector: unknown
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
          fit_note?: string | null
          fit_rating?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          main_image: string
          name: string
          price: number
          pricing_config?: Json | null
          search_vector?: unknown
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
          fit_note?: string | null
          fit_rating?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          main_image?: string
          name?: string
          price?: number
          pricing_config?: Json | null
          search_vector?: unknown
          sizes?: string[] | null
          sizing_type?: string | null
          stock?: number
          sub_category?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          hits: number
          key: string
          updated_at: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          updated_at?: string
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      search_queries: {
        Row: {
          created_at: string
          id: string
          query: string
          result_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          result_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          result_count?: number
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
      stock_alerts: {
        Row: {
          created_at: string
          email: string
          id: string
          notified_at: string | null
          product_id: string
          variant_key: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notified_at?: string | null
          product_id: string
          variant_key?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notified_at?: string | null
          product_id?: string
          variant_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "most_wishlisted"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          bank_sort_code: string | null
          contact_phone: string | null
          free_shipping_threshold: number
          id: number
          low_stock_threshold: number
          notify_marketing: boolean
          notify_order_received: boolean
          notify_sms: boolean
          notify_status_change: boolean
          order_number_prefix: string
          reorder_cover_days: number
          reorder_lead_days: number
          store_name: string
          support_email: string | null
          tax_rate: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          bank_sort_code?: string | null
          contact_phone?: string | null
          free_shipping_threshold?: number
          id?: number
          low_stock_threshold?: number
          notify_marketing?: boolean
          notify_order_received?: boolean
          notify_sms?: boolean
          notify_status_change?: boolean
          order_number_prefix?: string
          reorder_cover_days?: number
          reorder_lead_days?: number
          store_name?: string
          support_email?: string | null
          tax_rate?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          bank_sort_code?: string | null
          contact_phone?: string | null
          free_shipping_threshold?: number
          id?: number
          low_stock_threshold?: number
          notify_marketing?: boolean
          notify_order_received?: boolean
          notify_sms?: boolean
          notify_status_change?: boolean
          order_number_prefix?: string
          reorder_cover_days?: number
          reorder_lead_days?: number
          store_name?: string
          support_email?: string | null
          tax_rate?: number
          updated_at?: string
          updated_by?: string | null
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
          name: string | null
          unsubscribe_source: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean | null
          name?: string | null
          unsubscribe_source?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string | null
          unsubscribe_source?: string | null
          unsubscribed_at?: string | null
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
      customer_addresses: {
        Row: {
          city: string | null
          customer_id: string | null
          delivery_address: string | null
          last_used_at: string | null
          selected_lga: string | null
          selected_state: string | null
          times_used: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_stats"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_stats: {
        Row: {
          customer_id: string | null
          email: string | null
          first_order_at: string | null
          full_name: string | null
          is_blocked: boolean | null
          last_order_at: string | null
          lifetime_refunded: number | null
          lifetime_value: number | null
          net_lifetime_value: number | null
          orders_cancelled: number | null
          orders_revenue: number | null
          orders_total: number | null
          phone_e164: string | null
          tags: string[] | null
        }
        Relationships: []
      }
      most_wishlisted: {
        Row: {
          last_saved_at: string | null
          main_image: string | null
          price: number | null
          product_id: string | null
          product_name: string | null
          saved_by: number | null
          stock: number | null
        }
        Relationships: []
      }
      order_cancellations: {
        Row: {
          amount_paid: number | null
          amount_refunded: number | null
          cancelled_at: string | null
          cancelled_by: string | null
          customer_email: string | null
          customer_id: string | null
          order_id: string | null
          order_number: string | null
          ordered_at: string | null
          reason: string | null
          reason_code: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_stats"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_review_stats: {
        Row: {
          five_star: number | null
          four_star: number | null
          one_star: number | null
          product_id: string | null
          rating_average: number | null
          review_count: number | null
          three_star: number | null
          two_star: number | null
          verified_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "most_wishlisted"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sales: {
        Row: {
          product_id: string | null
          units_sold: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "most_wishlisted"
            referencedColumns: ["product_id"]
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
      store_settings_public: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          bank_sort_code: string | null
          contact_phone: string | null
          free_shipping_threshold: number | null
          low_stock_threshold: number | null
          store_name: string | null
          support_email: string | null
          tax_rate: number | null
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          bank_sort_code?: string | null
          contact_phone?: string | null
          free_shipping_threshold?: number | null
          low_stock_threshold?: number | null
          store_name?: string | null
          support_email?: string | null
          tax_rate?: number | null
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          bank_sort_code?: string | null
          contact_phone?: string | null
          free_shipping_threshold?: number | null
          low_stock_threshold?: number | null
          store_name?: string | null
          support_email?: string | null
          tax_rate?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_order_stock: {
        Args: {
          p_actor_id?: string
          p_items: Json
          p_reference_id?: string
          p_reserve: boolean
        }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          p_count?: boolean
          p_key: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: Json
      }
      co_purchased_product_ids: {
        Args: { p_limit?: number; p_product_ids: string[] }
        Returns: {
          product_id: string
        }[]
      }
      count_products: {
        Args: {
          p_category?: string
          p_colors?: string[]
          p_in_stock_only?: boolean
          p_max_price?: number
          p_min_price?: number
          p_sizes?: string[]
          p_subcategory?: string
        }
        Returns: number
      }
      edit_order_items: {
        Args: {
          p_discount?: number
          p_discount_reason?: string
          p_items: Json
          p_order_id: string
          p_tax_rate: number
        }
        Returns: Json
      }
      inventory_context: { Args: { p_key: string }; Returns: string }
      is_active_admin: { Args: never; Returns: boolean }
      list_products: {
        Args: {
          p_category?: string
          p_colors?: string[]
          p_cursor_created?: string
          p_cursor_id?: string
          p_cursor_name?: string
          p_cursor_price?: number
          p_cursor_sold?: number
          p_cursor_sold_out?: boolean
          p_in_stock_only?: boolean
          p_limit?: number
          p_max_price?: number
          p_min_price?: number
          p_sizes?: string[]
          p_sort?: string
          p_subcategory?: string
        }
        Returns: {
          category: string
          description: string
          id: string
          main_image: string
          name: string
          price: number
          price_max: number
          price_min: number
          sort_value: string
          stock: number
          sub_category: string
        }[]
      }
      normalise_ng_msisdn: { Args: { p_input: string }; Returns: string }
      product_candidates: {
        Args: {
          p_category?: string
          p_colors?: string[]
          p_in_stock_only?: boolean
          p_max_price?: number
          p_min_price?: number
          p_sizes?: string[]
          p_subcategory?: string
        }
        Returns: {
          eff_price: number
          is_sold_out: boolean
          product_id: string
          sort_created: string
          sort_name: string
          units_sold: number
        }[]
      }
      product_cards: {
        Args: { p_ids: string[] }
        Returns: {
          category: string
          description: string
          id: string
          main_image: string
          name: string
          price: number
          price_max: number
          price_min: number
          stock: number
          sub_category: string
        }[]
      }
      product_facet_options: {
        Args: { p_category?: string; p_subcategory?: string }
        Returns: Json
      }
      prune_audit_log: { Args: { p_older_than_days?: number }; Returns: number }
      prune_customer_auth: {
        Args: { p_keep_days?: number }
        Returns: {
          sessions_deleted: number
          tokens_deleted: number
        }[]
      }
      prune_rate_limits: {
        Args: { p_older_than_hours?: number }
        Returns: number
      }
      rebuild_product_pairs: {
        Args: { p_min_orders?: number }
        Returns: number
      }
      related_product_ids: {
        Args: { p_limit?: number; p_product_id: string }
        Returns: {
          product_id: string
        }[]
      }
      replace_product_variants: {
        Args: { p_product_id: string; p_variants: Json }
        Returns: Json
      }
      reserve_order_number: {
        Args: { p_idempotency_key: string }
        Returns: string
      }
      reset_rate_limit: { Args: { p_key: string }; Returns: undefined }
      search_products: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          category: string
          id: string
          main_image: string
          name: string
          price: number
          rank: number
          stock: number
          sub_category: string
        }[]
      }
      set_inventory_context: {
        Args: {
          p_actor_id?: string
          p_note?: string
          p_reason: string
          p_reference_id?: string
          p_reference_type?: string
        }
        Returns: undefined
      }
      set_variant_stock: {
        Args: {
          p_actor_id?: string
          p_new_stock: number
          p_note?: string
          p_product_id: string
          p_reason?: string
          p_variant_key: string
        }
        Returns: Json
      }
      sync_product_stock_total: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      sync_variants_from_pricing_config: {
        Args: { p_product_id: string }
        Returns: Json
      }
      variant_key: {
        Args: { p_color: string; p_size: string }
        Returns: string
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
    Enums: {},
  },
} as const
