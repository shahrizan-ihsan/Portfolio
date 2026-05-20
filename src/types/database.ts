export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      application_timeline_events: {
        Row: {
          application_id: string
          description: string | null
          id: string
          occurred_at: string | null
          source: string | null
          status: string
          title: string
        }
        Insert: {
          application_id: string
          description?: string | null
          id?: string
          occurred_at?: string | null
          source?: string | null
          status: string
          title: string
        }
        Update: {
          application_id?: string
          description?: string | null
          id?: string
          occurred_at?: string | null
          source?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_timeline_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          action_required: boolean | null
          applied_date: string | null
          channel: string | null
          created_at: string | null
          employer_name: string
          expected_next_update_date: string | null
          id: string
          job_url: string | null
          notes: string | null
          resume_id: string | null
          role_title: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          action_required?: boolean | null
          applied_date?: string | null
          channel?: string | null
          created_at?: string | null
          employer_name: string
          expected_next_update_date?: string | null
          id?: string
          job_url?: string | null
          notes?: string | null
          resume_id?: string | null
          role_title: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          action_required?: boolean | null
          applied_date?: string | null
          channel?: string | null
          created_at?: string | null
          employer_name?: string
          expected_next_update_date?: string | null
          id?: string
          job_url?: string | null
          notes?: string | null
          resume_id?: string | null
          role_title?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          application_id: string
          created_at: string | null
          feedback_type: string | null
          id: string
          message: string
          source: string | null
          suggested_actions: string[] | null
        }
        Insert: {
          application_id: string
          created_at?: string | null
          feedback_type?: string | null
          id?: string
          message: string
          source?: string | null
          suggested_actions?: string[] | null
        }
        Update: {
          application_id?: string
          created_at?: string | null
          feedback_type?: string | null
          id?: string
          message?: string
          source?: string | null
          suggested_actions?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          related_application_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          related_application_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          related_application_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_application_id_fkey"
            columns: ["related_application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          experience_level: string | null
          full_name: string | null
          id: string
          location: string | null
          phone: string | null
          preferred_language: string | null
          skills: string[] | null
          target_roles: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          experience_level?: string | null
          full_name?: string | null
          id?: string
          location?: string | null
          phone?: string | null
          preferred_language?: string | null
          skills?: string[] | null
          target_roles?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          experience_level?: string | null
          full_name?: string | null
          id?: string
          location?: string | null
          phone?: string | null
          preferred_language?: string | null
          skills?: string[] | null
          target_roles?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      resumes: {
        Row: {
          file_name: string
          file_url: string
          id: string
          label: string
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          file_name: string
          file_url: string
          id?: string
          label: string
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          file_name?: string
          file_url?: string
          id?: string
          label?: string
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Domain type aliases using the generated DB types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Resume = Database['public']['Tables']['resumes']['Row']
export type Application = Database['public']['Tables']['applications']['Row']
export type ApplicationTimelineEvent = Database['public']['Tables']['application_timeline_events']['Row']
export type Feedback = Database['public']['Tables']['feedback']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']

export type ApplicationStatus =
  | 'drafted' | 'submitted' | 'acknowledged' | 'under_review'
  | 'action_required' | 'interview' | 'rejected' | 'offer' | 'withdrawn'
