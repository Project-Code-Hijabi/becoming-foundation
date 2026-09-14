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
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          publish_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          publish_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          publish_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendee_badges: {
        Row: {
          created_at: string
          id: string
          issued_at: string
          qr_token: string
          registration_id: string
          status: Database["public"]["Enums"]["badge_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issued_at?: string
          qr_token?: string
          registration_id: string
          status?: Database["public"]["Enums"]["badge_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issued_at?: string
          qr_token?: string
          registration_id?: string
          status?: Database["public"]["Enums"]["badge_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendee_badges_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      award_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_published: boolean
          name: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_published?: boolean
          name: string
          updated_at?: string
          year?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_published?: boolean
          name?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      award_recipients: {
        Row: {
          category_id: string
          created_at: string
          display_order: number
          id: string
          person_id: string | null
          recipient_name: string | null
          recognition_note: string | null
          team_id: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          display_order?: number
          id?: string
          person_id?: string | null
          recipient_name?: string | null
          recognition_note?: string | null
          team_id?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          display_order?: number
          id?: string
          person_id?: string | null
          recipient_name?: string | null
          recognition_note?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "award_recipients_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "award_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "award_recipients_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "award_recipients_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "hackathon_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      badge_scans: {
        Row: {
          id: string
          scanned_at: string
          scanned_user_id: string
          scanner_user_id: string
        }
        Insert: {
          id?: string
          scanned_at?: string
          scanned_user_id: string
          scanner_user_id: string
        }
        Update: {
          id?: string
          scanned_at?: string
          scanned_user_id?: string
          scanner_user_id?: string
        }
        Relationships: []
      }
      becoming_entries: {
        Row: {
          body: string | null
          created_at: string
          entry_type: Database["public"]["Enums"]["becoming_entry_type"]
          id: string
          is_public: boolean
          media_path: string | null
          metadata: Json
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entry_type?: Database["public"]["Enums"]["becoming_entry_type"]
          id?: string
          is_public?: boolean
          media_path?: string | null
          metadata?: Json
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entry_type?: Database["public"]["Enums"]["becoming_entry_type"]
          id?: string
          is_public?: boolean
          media_path?: string | null
          metadata?: Json
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          badge_id: string
          checked_in_at: string
          checked_in_by: string | null
          id: string
          is_override: boolean
          notes: string | null
          programme_item_id: string | null
          user_id: string
        }
        Insert: {
          badge_id: string
          checked_in_at?: string
          checked_in_by?: string | null
          id?: string
          is_override?: boolean
          notes?: string | null
          programme_item_id?: string | null
          user_id: string
        }
        Update: {
          badge_id?: string
          checked_in_at?: string
          checked_in_by?: string | null
          id?: string
          is_override?: boolean
          notes?: string | null
          programme_item_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "attendee_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_programme_item_fkey"
            columns: ["programme_item_id"]
            isOneToOne: false
            referencedRelation: "programme_items"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          recipient_id: string
          requester_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["connection_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          recipient_id: string
          requester_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          recipient_id?: string
          requester_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Relationships: []
      }
      connections: {
        Row: {
          connected_at: string
          id: string
          request_id: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          connected_at?: string
          id?: string
          request_id?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          connected_at?: string
          id?: string
          request_id?: string | null
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "connection_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      dear_future_me: {
        Row: {
          content: string
          created_at: string
          deliver_at: string | null
          delivered_at: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deliver_at?: string | null
          delivered_at?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deliver_at?: string | null
          delivered_at?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hackathon_team_members: {
        Row: {
          created_at: string
          display_order: number
          full_name: string
          id: string
          photo_path: string | null
          role: string | null
          team_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          full_name: string
          id?: string
          photo_path?: string | null
          role?: string | null
          team_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          full_name?: string
          id?: string
          photo_path?: string | null
          role?: string | null
          team_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hackathon_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "hackathon_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      hackathon_teams: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_finalist: boolean
          is_published: boolean
          logo_path: string | null
          name: string
          pitch_summary: string | null
          pitch_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_finalist?: boolean
          is_published?: boolean
          logo_path?: string | null
          name: string
          pitch_summary?: string | null
          pitch_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_finalist?: boolean
          is_published?: boolean
          logo_path?: string | null
          name?: string
          pitch_summary?: string | null
          pitch_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_kobo: number
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          paid_at: string | null
          provider: string
          provider_payload: Json | null
          provider_transaction_id: string | null
          registration_id: string
          status: Database["public"]["Enums"]["payment_status"]
          tx_ref: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          paid_at?: string | null
          provider?: string
          provider_payload?: Json | null
          provider_transaction_id?: string | null
          registration_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          tx_ref: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          paid_at?: string | null
          provider?: string
          provider_payload?: Json | null
          provider_transaction_id?: string | null
          registration_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          tx_ref?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          bio: string | null
          created_at: string
          display_order: number
          full_name: string
          id: string
          instagram: string | null
          is_published: boolean
          linkedin: string | null
          organisation: string | null
          person_type: Database["public"]["Enums"]["person_type"]
          photo_path: string | null
          title: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_order?: number
          full_name: string
          id?: string
          instagram?: string | null
          is_published?: boolean
          linkedin?: string | null
          organisation?: string | null
          person_type?: Database["public"]["Enums"]["person_type"]
          photo_path?: string | null
          title?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_order?: number
          full_name?: string
          id?: string
          instagram?: string | null
          is_published?: boolean
          linkedin?: string | null
          organisation?: string | null
          person_type?: Database["public"]["Enums"]["person_type"]
          photo_path?: string | null
          title?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      profile_privacy: {
        Row: {
          created_at: string
          networking_enabled: boolean
          profile_discoverable: boolean
          profile_id: string
          show_email_to_connections: boolean
          show_instagram_to_connections: boolean
          show_linkedin_to_connections: boolean
          show_phone_to_connections: boolean
          show_whatsapp_to_connections: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          networking_enabled?: boolean
          profile_discoverable?: boolean
          profile_id: string
          show_email_to_connections?: boolean
          show_instagram_to_connections?: boolean
          show_linkedin_to_connections?: boolean
          show_phone_to_connections?: boolean
          show_whatsapp_to_connections?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          networking_enabled?: boolean
          profile_discoverable?: boolean
          profile_id?: string
          show_email_to_connections?: boolean
          show_instagram_to_connections?: boolean
          show_linkedin_to_connections?: boolean
          show_phone_to_connections?: boolean
          show_whatsapp_to_connections?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_privacy_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          instagram: string | null
          interests: string[]
          linkedin: string | null
          location: string | null
          networking_preferences: string | null
          organisation: string | null
          phone: string | null
          photo_path: string | null
          profession: string | null
          skills: string[]
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          instagram?: string | null
          interests?: string[]
          linkedin?: string | null
          location?: string | null
          networking_preferences?: string | null
          organisation?: string | null
          phone?: string | null
          photo_path?: string | null
          profession?: string | null
          skills?: string[]
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          instagram?: string | null
          interests?: string[]
          linkedin?: string | null
          location?: string | null
          networking_preferences?: string | null
          organisation?: string | null
          phone?: string | null
          photo_path?: string | null
          profession?: string | null
          skills?: string[]
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      programme_items: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          ends_at: string | null
          id: string
          is_published: boolean
          location: string | null
          session_type: Database["public"]["Enums"]["session_type"]
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          ends_at?: string | null
          id?: string
          is_published?: boolean
          location?: string | null
          session_type?: Database["public"]["Enums"]["session_type"]
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          ends_at?: string | null
          id?: string
          is_published?: boolean
          location?: string | null
          session_type?: Database["public"]["Enums"]["session_type"]
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          accessibility_notes: string | null
          amount_kobo: number
          attendee_code: string
          created_at: string
          currency: string
          dietary_notes: string | null
          id: string
          paid_at: string | null
          payment_reference: string | null
          status: Database["public"]["Enums"]["registration_status"]
          ticket_type_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accessibility_notes?: string | null
          amount_kobo: number
          attendee_code: string
          created_at?: string
          currency?: string
          dietary_notes?: string | null
          id?: string
          paid_at?: string | null
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          ticket_type_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accessibility_notes?: string | null
          amount_kobo?: number
          attendee_code?: string
          created_at?: string
          currency?: string
          dietary_notes?: string | null
          id?: string
          paid_at?: string | null
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          ticket_type_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      session_speakers: {
        Row: {
          created_at: string
          display_order: number
          id: string
          person_id: string
          programme_item_id: string
          speaking_role: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          person_id: string
          programme_item_id: string
          speaking_role?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          person_id?: string
          programme_item_id?: string
          speaking_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_speakers_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_speakers_programme_item_id_fkey"
            columns: ["programme_item_id"]
            isOneToOne: false
            referencedRelation: "programme_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_types: {
        Row: {
          code: string
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_kobo: number
          quantity_cap: number | null
          sales_end: string | null
          sales_start: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_kobo: number
          quantity_cap?: number | null
          sales_end?: string | null
          sales_start?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_kobo?: number
          quantity_cap?: number | null
          sales_end?: string | null
          sales_start?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
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
      are_connected: { Args: { _a: string; _b: string }; Returns: boolean }
      get_shareable_profile: {
        Args: { _target: string }
        Returns: {
          bio: string
          email: string
          full_name: string
          id: string
          instagram: string
          interests: string[]
          is_connected: boolean
          linkedin: string
          location: string
          networking_preferences: string
          organisation: string
          phone: string
          photo_path: string
          profession: string
          skills: string[]
          whatsapp: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "staff" | "attendee" | "speaker"
      badge_status: "active" | "revoked"
      becoming_entry_type: "reflection" | "memory" | "note" | "media" | "other"
      connection_status: "pending" | "accepted" | "declined" | "blocked"
      payment_status:
        | "pending"
        | "successful"
        | "failed"
        | "cancelled"
        | "refunded"
      person_type:
        | "speaker"
        | "panelist"
        | "fireside_guest"
        | "special_guest"
        | "grand_honoree"
        | "host"
        | "sponsor"
      registration_status: "pending" | "paid" | "cancelled" | "refunded"
      session_type:
        | "keynote"
        | "panel"
        | "fireside"
        | "hackathon"
        | "award"
        | "networking"
        | "break"
        | "opening"
        | "closing"
        | "other"
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
      app_role: ["super_admin", "admin", "staff", "attendee", "speaker"],
      badge_status: ["active", "revoked"],
      becoming_entry_type: ["reflection", "memory", "note", "media", "other"],
      connection_status: ["pending", "accepted", "declined", "blocked"],
      payment_status: [
        "pending",
        "successful",
        "failed",
        "cancelled",
        "refunded",
      ],
      person_type: [
        "speaker",
        "panelist",
        "fireside_guest",
        "special_guest",
        "grand_honoree",
        "host",
        "sponsor",
      ],
      registration_status: ["pending", "paid", "cancelled", "refunded"],
      session_type: [
        "keynote",
        "panel",
        "fireside",
        "hackathon",
        "award",
        "networking",
        "break",
        "opening",
        "closing",
        "other",
      ],
    },
  },
} as const
