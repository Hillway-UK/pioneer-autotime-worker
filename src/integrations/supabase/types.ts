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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      additional_costs: {
        Row: {
          amount: number
          clock_entry_id: string | null
          cost_type: string
          created_at: string | null
          date: string | null
          description: string
          expense_type_id: string | null
          id: string
          worker_id: string | null
        }
        Insert: {
          amount: number
          clock_entry_id?: string | null
          cost_type: string
          created_at?: string | null
          date?: string | null
          description: string
          expense_type_id?: string | null
          id?: string
          worker_id?: string | null
        }
        Update: {
          amount?: number
          clock_entry_id?: string | null
          cost_type?: string
          created_at?: string | null
          date?: string | null
          description?: string
          expense_type_id?: string | null
          id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "additional_costs_clock_entry_id_fkey"
            columns: ["clock_entry_id"]
            isOneToOne: false
            referencedRelation: "clock_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "additional_costs_expense_type_id_fkey"
            columns: ["expense_type_id"]
            isOneToOne: false
            referencedRelation: "expense_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "additional_costs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          target_id: string
          timestamp: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id: string
          timestamp?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string
          timestamp?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      auto_clockout_audit: {
        Row: {
          decided_at: string
          decided_by: string
          id: string
          notes: string | null
          performed: boolean
          reason: Database["public"]["Enums"]["auto_clockout_reason"]
          shift_date: string
          worker_id: string
        }
        Insert: {
          decided_at?: string
          decided_by?: string
          id?: string
          notes?: string | null
          performed: boolean
          reason: Database["public"]["Enums"]["auto_clockout_reason"]
          shift_date: string
          worker_id: string
        }
        Update: {
          decided_at?: string
          decided_by?: string
          id?: string
          notes?: string | null
          performed?: boolean
          reason?: Database["public"]["Enums"]["auto_clockout_reason"]
          shift_date?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_clockout_audit_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_clockout_counters: {
        Row: {
          count_monthly: number
          last_auto_clockout_at: string | null
          last_workday_auto: string | null
          month: string
          rolling14_count: number
          updated_at: string
          worker_id: string
        }
        Insert: {
          count_monthly?: number
          last_auto_clockout_at?: string | null
          last_workday_auto?: string | null
          month: string
          rolling14_count?: number
          updated_at?: string
          worker_id: string
        }
        Update: {
          count_monthly?: number
          last_auto_clockout_at?: string | null
          last_workday_auto?: string | null
          month?: string
          rolling14_count?: number
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_clockout_counters_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: true
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      clock_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          auto_clocked_out: boolean | null
          auto_clockout_type: string | null
          clock_in: string
          clock_in_lat: number | null
          clock_in_lng: number | null
          clock_in_photo: string | null
          clock_out: string | null
          clock_out_lat: number | null
          clock_out_lng: number | null
          clock_out_photo: string | null
          created_at: string | null
          geofence_exit_data: Json | null
          id: string
          job_id: string
          manual_entry: boolean | null
          needs_approval: boolean | null
          notes: string | null
          photo_required: boolean | null
          source: string | null
          total_hours: number | null
          worker_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          auto_clocked_out?: boolean | null
          auto_clockout_type?: string | null
          clock_in: string
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_in_photo?: string | null
          clock_out?: string | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          clock_out_photo?: string | null
          created_at?: string | null
          geofence_exit_data?: Json | null
          id?: string
          job_id: string
          manual_entry?: boolean | null
          needs_approval?: boolean | null
          notes?: string | null
          photo_required?: boolean | null
          source?: string | null
          total_hours?: number | null
          worker_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          auto_clocked_out?: boolean | null
          auto_clockout_type?: string | null
          clock_in?: string
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_in_photo?: string | null
          clock_out?: string | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          clock_out_photo?: string | null
          created_at?: string | null
          geofence_exit_data?: Json | null
          id?: string
          job_id?: string
          manual_entry?: boolean | null
          needs_approval?: boolean | null
          notes?: string | null
          photo_required?: boolean | null
          source?: string | null
          total_hours?: number | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clock_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_entries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      clock_entry_history: {
        Row: {
          amendment_id: string | null
          change_type: string
          changed_at: string
          changed_by: string
          clock_entry_id: string
          id: string
          metadata: Json | null
          new_clock_in: string | null
          new_clock_out: string | null
          new_total_hours: number | null
          notes: string | null
          old_clock_in: string | null
          old_clock_out: string | null
          old_total_hours: number | null
        }
        Insert: {
          amendment_id?: string | null
          change_type: string
          changed_at?: string
          changed_by: string
          clock_entry_id: string
          id?: string
          metadata?: Json | null
          new_clock_in?: string | null
          new_clock_out?: string | null
          new_total_hours?: number | null
          notes?: string | null
          old_clock_in?: string | null
          old_clock_out?: string | null
          old_total_hours?: number | null
        }
        Update: {
          amendment_id?: string | null
          change_type?: string
          changed_at?: string
          changed_by?: string
          clock_entry_id?: string
          id?: string
          metadata?: Json | null
          new_clock_in?: string | null
          new_clock_out?: string | null
          new_total_hours?: number | null
          notes?: string | null
          old_clock_in?: string | null
          old_clock_out?: string | null
          old_total_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clock_entry_history_amendment_id_fkey"
            columns: ["amendment_id"]
            isOneToOne: false
            referencedRelation: "time_amendments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_entry_history_clock_entry_id_fkey"
            columns: ["clock_entry_id"]
            isOneToOne: false
            referencedRelation: "clock_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_requests: {
        Row: {
          admin_users: number | null
          company: string | null
          contacted_at: string | null
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          notes: string | null
          phone: string | null
          status: string | null
          updated_at: string
          worker_count: number | null
        }
        Insert: {
          admin_users?: number | null
          company?: string | null
          contacted_at?: string | null
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string
          worker_count?: number | null
        }
        Update: {
          admin_users?: number | null
          company?: string | null
          contacted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string
          worker_count?: number | null
        }
        Relationships: []
      }
      expense_types: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      geofence_events: {
        Row: {
          accuracy: number
          clock_entry_id: string
          created_at: string | null
          distance_from_center: number
          event_type: string
          id: string
          job_radius: number
          latitude: number
          longitude: number
          metadata: Json | null
          safe_out_threshold: number
          shift_date: string
          timestamp: string
          worker_id: string
        }
        Insert: {
          accuracy: number
          clock_entry_id: string
          created_at?: string | null
          distance_from_center: number
          event_type: string
          id?: string
          job_radius: number
          latitude: number
          longitude: number
          metadata?: Json | null
          safe_out_threshold: number
          shift_date: string
          timestamp: string
          worker_id: string
        }
        Update: {
          accuracy?: number
          clock_entry_id?: string
          created_at?: string | null
          distance_from_center?: number
          event_type?: string
          id?: string
          job_radius?: number
          latitude?: number
          longitude?: number
          metadata?: Json | null
          safe_out_threshold?: number
          shift_date?: string
          timestamp?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofence_events_clock_entry_id_fkey"
            columns: ["clock_entry_id"]
            isOneToOne: false
            referencedRelation: "clock_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          address: string
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          code: string
          county: string | null
          created_at: string | null
          geofence_radius: number | null
          id: string
          is_active: boolean | null
          latitude: number
          longitude: number
          name: string
          organization_id: string | null
          postcode: string | null
          shift_days: number[] | null
          shift_end: string | null
          shift_start: string | null
        }
        Insert: {
          address: string
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          code: string
          county?: string | null
          created_at?: string | null
          geofence_radius?: number | null
          id?: string
          is_active?: boolean | null
          latitude: number
          longitude: number
          name: string
          organization_id?: string | null
          postcode?: string | null
          shift_days?: number[] | null
          shift_end?: string | null
          shift_start?: string | null
        }
        Update: {
          address?: string
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          code?: string
          county?: string | null
          created_at?: string | null
          geofence_radius?: number | null
          id?: string
          is_active?: boolean | null
          latitude?: number
          longitude?: number
          name?: string
          organization_id?: string | null
          postcode?: string | null
          shift_days?: number[] | null
          shift_end?: string | null
          shift_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      managers: {
        Row: {
          created_at: string | null
          email: string
          first_login_completed: boolean | null
          id: string
          is_admin: boolean | null
          is_super: boolean | null
          must_change_password: boolean | null
          name: string
          organization_id: string | null
          password_reset_count: number | null
          pin: string | null
          temporary_password_created_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          first_login_completed?: boolean | null
          id?: string
          is_admin?: boolean | null
          is_super?: boolean | null
          must_change_password?: boolean | null
          name: string
          organization_id?: string | null
          password_reset_count?: number | null
          pin?: string | null
          temporary_password_created_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_login_completed?: boolean | null
          id?: string
          is_admin?: boolean | null
          is_super?: boolean | null
          must_change_password?: boolean | null
          name?: string
          organization_id?: string | null
          password_reset_count?: number | null
          pin?: string | null
          temporary_password_created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_managers_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "managers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          canceled: boolean | null
          id: string
          notification_type: string
          sent_at: string
          shift_date: string
          worker_id: string
        }
        Insert: {
          canceled?: boolean | null
          id?: string
          notification_type: string
          sent_at?: string
          shift_date: string
          worker_id: string
        }
        Update: {
          canceled?: boolean | null
          id?: string
          notification_type?: string
          sent_at?: string
          shift_date?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          enabled_days: number[] | null
          evening_reminder: boolean | null
          id: string
          morning_reminder: boolean | null
          push_token: string | null
          reminder_time_evening: string | null
          reminder_time_morning: string | null
          updated_at: string | null
          worker_id: string | null
        }
        Insert: {
          created_at?: string | null
          enabled_days?: number[] | null
          evening_reminder?: boolean | null
          id?: string
          morning_reminder?: boolean | null
          push_token?: string | null
          reminder_time_evening?: string | null
          reminder_time_morning?: string | null
          updated_at?: string | null
          worker_id?: string | null
        }
        Update: {
          created_at?: string | null
          enabled_days?: number[] | null
          evening_reminder?: boolean | null
          id?: string
          morning_reminder?: boolean | null
          push_token?: string | null
          reminder_time_evening?: string | null
          reminder_time_morning?: string | null
          updated_at?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string | null
          delivered_at: string | null
          failed_reason: string | null
          id: string
          read_at: string | null
          retry_count: number | null
          title: string
          type: string
          worker_id: string
        }
        Insert: {
          body: string
          created_at?: string
          dedupe_key?: string | null
          delivered_at?: string | null
          failed_reason?: string | null
          id?: string
          read_at?: string | null
          retry_count?: number | null
          title: string
          type?: string
          worker_id: string
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string | null
          delivered_at?: string | null
          failed_reason?: string | null
          id?: string
          read_at?: string | null
          retry_count?: number | null
          title?: string
          type?: string
          worker_id?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          address: string | null
          company_number: string | null
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_end_date: string | null
          subscription_start_date: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          updated_at: string | null
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          company_number?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          company_number?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      postcodes: {
        Row: {
          country: string | null
          county: string | null
          created_at: string
          id: string
          latitude: number
          longitude: number
          postcode: string
          town: string | null
        }
        Insert: {
          country?: string | null
          county?: string | null
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          postcode: string
          town?: string | null
        }
        Update: {
          country?: string | null
          county?: string | null
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          postcode?: string
          town?: string | null
        }
        Relationships: []
      }
      subscription_audit_log: {
        Row: {
          action: string
          after_count: number | null
          before_count: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
          trigger_source: string
        }
        Insert: {
          action: string
          after_count?: number | null
          before_count?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          trigger_source: string
        }
        Update: {
          action?: string
          after_count?: number | null
          before_count?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          trigger_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_usage: {
        Row: {
          active_managers: number | null
          active_workers: number | null
          billed: boolean | null
          created_at: string | null
          effective_end_date: string | null
          effective_start_date: string
          id: string
          month: string
          organization_id: string | null
          plan_type: string | null
          planned_number_of_managers: number | null
          planned_number_of_workers: number | null
          status: string
          superseded_by: string | null
          total_cost: number | null
        }
        Insert: {
          active_managers?: number | null
          active_workers?: number | null
          billed?: boolean | null
          created_at?: string | null
          effective_end_date?: string | null
          effective_start_date: string
          id?: string
          month: string
          organization_id?: string | null
          plan_type?: string | null
          planned_number_of_managers?: number | null
          planned_number_of_workers?: number | null
          status?: string
          superseded_by?: string | null
          total_cost?: number | null
        }
        Update: {
          active_managers?: number | null
          active_workers?: number | null
          billed?: boolean | null
          created_at?: string | null
          effective_end_date?: string | null
          effective_start_date?: string
          id?: string
          month?: string
          organization_id?: string | null
          plan_type?: string | null
          planned_number_of_managers?: number | null
          planned_number_of_workers?: number | null
          status?: string
          superseded_by?: string | null
          total_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_usage_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "subscription_usage"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_owner: boolean | null
          name: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_owner?: boolean | null
          name: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_owner?: boolean | null
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "super_admins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_amendments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          clock_entry_id: string
          created_at: string | null
          id: string
          manager_id: string | null
          manager_notes: string | null
          processed_at: string | null
          reason: string
          requested_clock_in: string | null
          requested_clock_out: string | null
          status: string | null
          worker_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          clock_entry_id: string
          created_at?: string | null
          id?: string
          manager_id?: string | null
          manager_notes?: string | null
          processed_at?: string | null
          reason: string
          requested_clock_in?: string | null
          requested_clock_out?: string | null
          status?: string | null
          worker_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          clock_entry_id?: string
          created_at?: string | null
          id?: string
          manager_id?: string | null
          manager_notes?: string | null
          processed_at?: string | null
          reason?: string
          requested_clock_in?: string | null
          requested_clock_out?: string | null
          status?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_amendments_clock_entry_id_fkey"
            columns: ["clock_entry_id"]
            isOneToOne: false
            referencedRelation: "clock_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_amendments_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_amendments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          address: string | null
          created_at: string | null
          date_started: string | null
          email: string
          emergency_contact: string | null
          emergency_phone: string | null
          first_login_info_dismissed: boolean | null
          hourly_rate: number
          id: string
          is_active: boolean | null
          must_change_password: boolean | null
          name: string
          organization_id: string
          phone: string | null
          photo_url: string | null
          pwa_install_info_dismissed: boolean | null
          shift_days: number[] | null
          shift_end: string | null
          shift_start: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          date_started?: string | null
          email: string
          emergency_contact?: string | null
          emergency_phone?: string | null
          first_login_info_dismissed?: boolean | null
          hourly_rate?: number
          id?: string
          is_active?: boolean | null
          must_change_password?: boolean | null
          name: string
          organization_id: string
          phone?: string | null
          photo_url?: string | null
          pwa_install_info_dismissed?: boolean | null
          shift_days?: number[] | null
          shift_end?: string | null
          shift_start?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          date_started?: string | null
          email?: string
          emergency_contact?: string | null
          emergency_phone?: string | null
          first_login_info_dismissed?: boolean | null
          hourly_rate?: number
          id?: string
          is_active?: boolean | null
          must_change_password?: boolean | null
          name?: string
          organization_id?: string
          phone?: string | null
          photo_url?: string | null
          pwa_install_info_dismissed?: boolean | null
          shift_days?: number[] | null
          shift_end?: string | null
          shift_start?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_workers_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_clock_out_after_12_hours: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      can_manage_organization: {
        Args: { target_org_id: string }
        Returns: boolean
      }
      check_capacity_with_plan: {
        Args: { org_id: string }
        Returns: {
          can_add_manager: boolean
          can_add_worker: boolean
          current_manager_count: number
          current_worker_count: number
          max_managers: number
          max_workers: number
          plan_name: string
          planned_managers: number
          planned_workers: number
        }[]
      }
      check_is_manager: {
        Args: { user_email: string }
        Returns: boolean
      }
      ensure_usage_row: {
        Args: { p_org: string }
        Returns: undefined
      }
      get_active_subscription_usage: {
        Args: { p_org_id: string }
        Returns: {
          active_managers: number | null
          active_workers: number | null
          billed: boolean | null
          created_at: string | null
          effective_end_date: string | null
          effective_start_date: string
          id: string
          month: string
          organization_id: string | null
          plan_type: string | null
          planned_number_of_managers: number | null
          planned_number_of_workers: number | null
          status: string
          superseded_by: string | null
          total_cost: number | null
        }
      }
      get_clocked_in_workers: {
        Args: Record<PropertyKey, never>
        Returns: {
          clock_in: string
          job_name: string
          worker_id: string
          worker_name: string
        }[]
      }
      get_current_user_permissions: {
        Args: Record<PropertyKey, never>
        Returns: {
          is_manager: boolean
          is_super_admin: boolean
          organization_id: string
        }[]
      }
      get_recent_activity: {
        Args: Record<PropertyKey, never>
        Returns: {
          clock_in: string
          clock_out: string
          id: string
          job_name: string
          total_hours: number
          worker_name: string
        }[]
      }
      get_subscription_capacity: {
        Args: { org_id: string }
        Returns: {
          active_managers: number
          active_workers: number
          managers_available: number
          planned_managers: number
          planned_workers: number
          workers_available: number
        }[]
      }
      get_total_hours_today: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_user_organization_id: {
        Args: { user_email: string }
        Returns: string
      }
      get_user_role_and_org: {
        Args: { user_email: string }
        Returns: {
          organization_id: string
          role: string
        }[]
      }
      get_worker_weekly_hours: {
        Args: { week_start: string; worker_uuid: string }
        Returns: number
      }
      is_manager: {
        Args: { user_email: string }
        Returns: boolean
      }
      is_super_admin: {
        Args: { user_email: string }
        Returns: boolean
      }
      is_super_admin_of_org: {
        Args: { org_id: string }
        Returns: boolean
      }
      reconcile_subscription_usage: {
        Args: Record<PropertyKey, never>
        Returns: {
          new_managers: number
          new_workers: number
          old_managers: number
          old_workers: number
          org_id: string
          org_name: string
        }[]
      }
      upgrade_subscription_plan: {
        Args: {
          p_new_max_managers: number
          p_new_max_workers: number
          p_org_id: string
          p_plan_type: string
        }
        Returns: string
      }
      user_is_manager_in_org: {
        Args: { check_org_id: string }
        Returns: boolean
      }
      user_is_super_admin_in_org: {
        Args: { check_org_id: string }
        Returns: boolean
      }
      user_is_worker: {
        Args: { check_worker_id: string }
        Returns: boolean
      }
      user_is_worker_in_org: {
        Args: { check_org_id: string }
        Returns: boolean
      }
      validate_subscription_counts: {
        Args: Record<PropertyKey, never>
        Returns: {
          expected_managers: number
          expected_workers: number
          manager_discrepancy: number
          organization_id: string
          organization_name: string
          recorded_managers: number
          recorded_workers: number
          worker_discrepancy: number
        }[]
      }
    }
    Enums: {
      auto_clockout_reason:
        | "OK"
        | "CAP_MONTH"
        | "CAP_ROLLING14"
        | "CONSECUTIVE_BLOCK"
        | "NO_CLOCK_IN"
        | "NO_SHIFT"
        | "ALREADY_CLOCKED_OUT"
        | "UNKNOWN"
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
      auto_clockout_reason: [
        "OK",
        "CAP_MONTH",
        "CAP_ROLLING14",
        "CONSECUTIVE_BLOCK",
        "NO_CLOCK_IN",
        "NO_SHIFT",
        "ALREADY_CLOCKED_OUT",
        "UNKNOWN",
      ],
    },
  },
} as const
